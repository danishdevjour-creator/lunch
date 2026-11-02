require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, getSettings, saveSettings, listMembers, getMember, getMemberByToken, newToken, round2 } = require('./db');
const { sendMemberEmail, checkBalanceAlert, emailConfigured } = require('./mailer');
const pay = require('./payments');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------- Admin auth (cookie session) ----------------

const sessions = new Set();

function getCookie(req, name) {
  const match = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function requireAdmin(req, res, next) {
  if (sessions.has(getCookie(req, 'sid'))) return next();
  res.status(401).json({ error: 'Login required' });
}

app.post('/api/login', (req, res) => {
  const given = Buffer.from(String(req.body.password || ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.add(sid);
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(getCookie(req, 'sid'));
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', requireAdmin, (req, res) => res.json({ ok: true }));

// ---------------- Helpers ----------------

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(400).json({ error: err.message });
  });

function positiveAmount(value) {
  const n = round2(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Amount must be greater than 0');
  return n;
}

const insertTx = db.prepare(`
  INSERT INTO transactions (member_id, type, amount, method, reference, gateway_ref, status, note, lunch_id)
  VALUES (@member_id, @type, @amount, @method, @reference, @gateway_ref, @status, @note, @lunch_id)
`);

function addTx(tx) {
  const given = Object.fromEntries(Object.entries(tx).filter(([, v]) => v !== undefined && v !== ''));
  const row = { reference: null, gateway_ref: null, status: 'approved', note: null, lunch_id: null, method: null, ...given };
  return Number(insertTx.run(row).lastInsertRowid);
}

const getTx = db.prepare('SELECT * FROM transactions WHERE id = ?');
const setTxStatus = db.prepare('UPDATE transactions SET status = ? WHERE id = ?');

async function approveDeposit(txId) {
  const tx = getTx.get(txId);
  if (!tx) throw new Error('Transaction not found');
  if (tx.status === 'approved') return tx;
  setTxStatus.run('approved', tx.id);
  const member = getMember(tx.member_id);
  await sendMemberEmail('received', member, tx);
  await checkBalanceAlert(tx.member_id);
  return getTx.get(txId);
}

// ---------------- Dashboard ----------------

app.get('/api/summary', requireAdmin, (req, res) => {
  const members = listMembers();
  const threshold = Number(getSettings().low_balance_threshold || 0);
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='deposit' AND status='approved' THEN amount END),0) AS collected,
      COALESCE(SUM(CASE WHEN type='expense' AND status='approved' THEN amount END),0) AS spent,
      COALESCE(SUM(CASE WHEN type='deposit' AND status='pending'  THEN amount END),0) AS pending_amount,
      COUNT(CASE WHEN type='deposit' AND status='pending' THEN 1 END) AS pending_count
    FROM transactions
  `).get();
  const monthly = db.prepare(`
    SELECT substr(created_at,1,7) AS month,
      COALESCE(SUM(CASE WHEN type='deposit' AND status='approved' THEN amount END),0) AS collected,
      COALESCE(SUM(CASE WHEN type='expense' AND status='approved' THEN amount END),0) AS spent
    FROM transactions GROUP BY month ORDER BY month DESC LIMIT 6
  `).all().reverse();
  const recent = db.prepare(`
    SELECT t.*, m.name AS member_name FROM transactions t JOIN members m ON m.id = t.member_id
    ORDER BY t.id DESC LIMIT 10
  `).all();
  res.json({
    ...totals,
    balance: round2(totals.collected - totals.spent),
    member_count: members.length,
    empty: members.filter((m) => m.balance <= 0),
    low: members.filter((m) => m.balance > 0 && m.balance <= threshold),
    monthly,
    recent,
    config: { email: emailConfigured, jazzcash: pay.jazzcashEnabled, meezan: pay.meezanEnabled },
  });
});

// ---------------- Members ----------------

app.get('/api/members', requireAdmin, (req, res) => {
  res.json(listMembers({ includeInactive: req.query.all === '1' }));
});

app.post('/api/members', requireAdmin, wrap(async (req, res) => {
  const { name, email, phone, department, opening_balance } = req.body;
  if (!name || !email) throw new Error('Name and email are required');
  const id = Number(db.prepare('INSERT INTO members (name, email, phone, department, token) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), email.trim(), phone || null, department || null, newToken()).lastInsertRowid);
  if (Number(opening_balance) > 0) {
    addTx({ member_id: id, type: 'deposit', amount: positiveAmount(opening_balance), method: 'cash', note: 'Opening balance' });
  }
  res.json(getMember(id));
}));

app.put('/api/members/:id', requireAdmin, wrap(async (req, res) => {
  const m = getMember(req.params.id);
  if (!m) throw new Error('Member not found');
  const { name = m.name, email = m.email, phone = m.phone, department = m.department, active = m.active } = req.body;
  db.prepare('UPDATE members SET name=?, email=?, phone=?, department=?, active=? WHERE id=?')
    .run(name, email, phone || null, department || null, active ? 1 : 0, m.id);
  res.json(getMember(m.id));
}));

app.delete('/api/members/:id', requireAdmin, wrap(async (req, res) => {
  const hasTx = db.prepare('SELECT 1 FROM transactions WHERE member_id = ? LIMIT 1').get(req.params.id);
  if (hasTx) {
    db.prepare('UPDATE members SET active = 0 WHERE id = ?').run(req.params.id);
    return res.json({ ok: true, deactivated: true });
  }
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/members/:id/transactions', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM transactions WHERE member_id = ? ORDER BY id DESC').all(req.params.id));
});

app.post('/api/members/:id/remind', requireAdmin, wrap(async (req, res) => {
  const m = getMember(req.params.id);
  if (!m) throw new Error('Member not found');
  const threshold = Number(getSettings().low_balance_threshold || 0);
  const kind = m.balance <= 0 ? 'empty' : m.balance <= threshold ? 'low' : 'statement';
  res.json(await sendMemberEmail(kind, m));
}));

app.post('/api/members/:id/regenerate-link', requireAdmin, (req, res) => {
  db.prepare('UPDATE members SET token = ? WHERE id = ?').run(newToken(), req.params.id);
  res.json(getMember(req.params.id));
});

// ---------------- Transactions ----------------

app.get('/api/transactions', requireAdmin, (req, res) => {
  const filters = [];
  const params = [];
  if (req.query.status) { filters.push('t.status = ?'); params.push(req.query.status); }
  if (req.query.type) { filters.push('t.type = ?'); params.push(req.query.type); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  res.json(db.prepare(`
    SELECT t.*, m.name AS member_name FROM transactions t JOIN members m ON m.id = t.member_id
    ${where} ORDER BY t.id DESC LIMIT 500
  `).all(...params));
});

// Admin records a cash deposit, a manual expense, or an adjustment
app.post('/api/transactions', requireAdmin, wrap(async (req, res) => {
  const { member_id, type, amount, method, reference, note } = req.body;
  if (!getMember(member_id)) throw new Error('Member not found');
  if (!['deposit', 'expense'].includes(type)) throw new Error('Invalid type');
  const id = addTx({ member_id, type, amount: positiveAmount(amount), method: method || (type === 'deposit' ? 'cash' : 'adjustment'), reference, note });
  if (type === 'deposit') await sendMemberEmail('received', getMember(member_id), getTx.get(id));
  await checkBalanceAlert(member_id);
  res.json(getTx.get(id));
}));

app.post('/api/transactions/:id/approve', requireAdmin, wrap(async (req, res) => {
  res.json(await approveDeposit(req.params.id));
}));

app.post('/api/transactions/:id/reject', requireAdmin, wrap(async (req, res) => {
  const tx = getTx.get(req.params.id);
  if (!tx) throw new Error('Transaction not found');
  setTxStatus.run('rejected', tx.id);
  await checkBalanceAlert(tx.member_id);
  res.json(getTx.get(tx.id));
}));

app.delete('/api/transactions/:id', requireAdmin, wrap(async (req, res) => {
  const tx = getTx.get(req.params.id);
  if (!tx) throw new Error('Transaction not found');
  db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  await checkBalanceAlert(tx.member_id);
  res.json({ ok: true });
}));

// ---------------- Lunches ----------------

app.get('/api/lunches', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM lunches ORDER BY date DESC, id DESC LIMIT 200').all());
});

// Body: { date, description, member_ids: [], per_person } OR { ..., total } to split equally
app.post('/api/lunches', requireAdmin, wrap(async (req, res) => {
  const { date, description, member_ids, per_person, total } = req.body;
  const ids = [...new Set((member_ids || []).map(Number))].filter((id) => getMember(id));
  if (!date) throw new Error('Date is required');
  if (!ids.length) throw new Error('Select at least one member');
  const each = per_person ? positiveAmount(per_person) : round2(positiveAmount(total) / ids.length);
  const lunchTotal = per_person ? round2(each * ids.length) : positiveAmount(total);

  db.exec('BEGIN');
  let lunchId;
  try {
    lunchId = Number(db.prepare('INSERT INTO lunches (date, description, total, per_person, headcount) VALUES (?, ?, ?, ?, ?)')
      .run(date, description || null, lunchTotal, each, ids.length).lastInsertRowid);
    for (const id of ids) {
      addTx({ member_id: id, type: 'expense', amount: each, method: 'lunch', note: `Lunch ${date}${description ? ' - ' + description : ''}`, lunch_id: lunchId });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  for (const id of ids) await checkBalanceAlert(id);
  res.json({ id: lunchId, per_person: each, total: lunchTotal, headcount: ids.length });
}));

app.delete('/api/lunches/:id', requireAdmin, wrap(async (req, res) => {
  const memberIds = db.prepare('SELECT member_id FROM transactions WHERE lunch_id = ?').all(req.params.id).map((r) => r.member_id);
  db.prepare('DELETE FROM lunches WHERE id = ?').run(req.params.id);
  for (const id of memberIds) await checkBalanceAlert(id);
  res.json({ ok: true });
}));

// ---------------- Settings & email log ----------------

app.get('/api/settings', requireAdmin, (req, res) => res.json(getSettings()));
app.put('/api/settings', requireAdmin, (req, res) => {
  saveSettings(req.body);
  res.json(getSettings());
});

app.get('/api/emails', requireAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT e.*, m.name AS member_name FROM emails e LEFT JOIN members m ON m.id = e.member_id
    ORDER BY e.id DESC LIMIT 200
  `).all());
});

// ---------------- Public member payment page ----------------

function publicMember(req) {
  const m = getMemberByToken(req.params.token);
  if (!m) throw new Error('Invalid or expired payment link');
  return m;
}

app.get('/api/public/:token', wrap(async (req, res) => {
  const m = publicMember(req);
  const s = getSettings();
  const history = db.prepare('SELECT type, amount, method, status, note, created_at FROM transactions WHERE member_id = ? ORDER BY id DESC LIMIT 15').all(m.id);
  res.json({
    member: { name: m.name, balance: m.balance, deposited: m.deposited, spent: m.spent, pending: m.pending },
    history,
    company_name: s.company_name,
    currency: s.currency,
    jazzcash: { online: pay.jazzcashEnabled, number: s.jazzcash_number, title: s.jazzcash_title },
    meezan: {
      online: pay.meezanEnabled,
      account_title: s.meezan_account_title,
      account_number: s.meezan_account_number,
      iban: s.meezan_iban,
      branch: s.meezan_branch,
    },
  });
}));

// Member says "I sent money manually" -> pending until admin approves
app.post('/api/public/:token/manual', wrap(async (req, res) => {
  const m = publicMember(req);
  const { method, amount, reference } = req.body;
  if (!['jazzcash', 'meezan'].includes(method)) throw new Error('Invalid payment method');
  if (!reference || String(reference).trim().length < 4) throw new Error('Please enter the transaction ID / reference number');
  const id = addTx({ member_id: m.id, type: 'deposit', amount: positiveAmount(amount), method, reference: String(reference).trim(), status: 'pending', note: 'Submitted by member' });
  res.json({ ok: true, id });
}));

app.post('/api/public/:token/jazzcash', wrap(async (req, res) => {
  if (!pay.jazzcashEnabled) throw new Error('JazzCash online payment is not configured');
  const m = publicMember(req);
  const amount = positiveAmount(req.body.amount);
  const txnRef = 'T' + Date.now() + crypto.randomBytes(2).toString('hex');
  addTx({ member_id: m.id, type: 'deposit', amount, method: 'jazzcash', gateway_ref: txnRef, status: 'pending', note: 'JazzCash online (awaiting confirmation)' });
  res.json(pay.jazzcashCheckout({ txnRef, amount, memberName: m.name, returnUrl: `${BASE_URL}/api/payments/jazzcash/return` }));
}));

app.post('/api/public/:token/meezan', wrap(async (req, res) => {
  if (!pay.meezanEnabled) throw new Error('Meezan Bank online payment is not configured');
  const m = publicMember(req);
  const amount = positiveAmount(req.body.amount);
  const orderNumber = 'M' + Date.now() + crypto.randomBytes(2).toString('hex');
  const result = await pay.meezanRegister({
    orderNumber,
    amount,
    returnUrl: `${BASE_URL}/api/payments/meezan/return`,
    description: `Lunch budget top-up - ${m.name}`,
  });
  addTx({ member_id: m.id, type: 'deposit', amount, method: 'meezan', gateway_ref: orderNumber, reference: result.orderId, status: 'pending', note: 'Meezan online (awaiting confirmation)' });
  res.json({ redirect: result.formUrl });
}));

const txByGatewayRef = db.prepare(`
  SELECT t.*, m.token FROM transactions t JOIN members m ON m.id = t.member_id WHERE t.gateway_ref = ?
`);

function backToPayPage(res, token, status, message) {
  const q = new URLSearchParams({ m: token || '', status, message: message || '' });
  res.redirect(`/pay.html?${q}`);
}

// JazzCash POSTs the result back to this URL
app.post('/api/payments/jazzcash/return', wrap(async (req, res) => {
  const result = pay.jazzcashVerify(req.body);
  const tx = result.txnRef && txByGatewayRef.get(result.txnRef);
  if (!tx) return res.status(404).send('Unknown transaction');
  if (!result.valid) return backToPayPage(res, tx.token, 'failed', 'Payment verification failed');
  if (result.success) {
    await approveDeposit(tx.id);
    return backToPayPage(res, tx.token, 'success', 'Payment received via JazzCash');
  }
  setTxStatus.run('rejected', tx.id);
  backToPayPage(res, tx.token, 'failed', result.message || 'Payment was not completed');
}));

// Meezan redirects the browser here with ?orderId=...
app.get('/api/payments/meezan/return', wrap(async (req, res) => {
  const status = await pay.meezanStatus(String(req.query.orderId || ''));
  const tx = status.orderNumber && txByGatewayRef.get(status.orderNumber);
  if (!tx) return res.status(404).send('Unknown transaction');
  if (status.paid) {
    await approveDeposit(tx.id);
    return backToPayPage(res, tx.token, 'success', 'Payment received via Meezan Bank');
  }
  setTxStatus.run('rejected', tx.id);
  backToPayPage(res, tx.token, 'failed', 'Payment was not completed');
}));

// ---------------- Static ----------------

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Lunch budget running at ${BASE_URL}`);
  console.log(`Email: ${emailConfigured ? 'SMTP configured' : 'NOT configured (emails are only logged)'}`);
  console.log(`JazzCash online: ${pay.jazzcashEnabled ? 'on' : 'off'} · Meezan online: ${pay.meezanEnabled ? 'on' : 'off'}`);
  if (!process.env.ADMIN_PASSWORD) console.log('WARNING: ADMIN_PASSWORD not set, using "admin"');
});
