require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { q, one, transaction, getSettings, saveSettings, listMembers, getMember, getMemberByToken, newToken, round2 } = require('./db');
const { sendMemberEmail, checkBalanceAlert, emailConfigured } = require('./mailer');
const pay = require('./payments');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Public URL for payment return links: BASE_URL, else Vercel's URL, else the request host.
function baseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// ---------------- Admin auth (stateless signed cookie, works on serverless) ----------------

const SESSION_DAYS = 7;
const sessionKey = () => crypto.createHash('sha256').update(`${process.env.SESSION_SECRET || ''}:${ADMIN_PASSWORD}`).digest();

function signSession(expires) {
  return crypto.createHmac('sha256', sessionKey()).update(`admin:${expires}`).digest('hex');
}

function validSession(cookie) {
  const [expires, sig] = String(cookie || '').split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const expected = signSession(expires);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function getCookie(req, name) {
  const match = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function requireAdmin(req, res, next) {
  if (validSession(getCookie(req, 'sid'))) return next();
  res.status(401).json({ error: 'Login required' });
}

app.post('/api/login', (req, res) => {
  const given = Buffer.from(String(req.body.password || ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${expires}.${signSession(expires)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}${secure}`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
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

const TX_COLUMNS = ['member_id', 'type', 'amount', 'method', 'reference', 'gateway_ref', 'status', 'note', 'lunch_id'];

async function addTx(tx, client) {
  const given = Object.fromEntries(Object.entries(tx).filter(([, v]) => v !== undefined && v !== ''));
  const row = { reference: null, gateway_ref: null, status: 'approved', note: null, lunch_id: null, method: null, ...given };
  const { id } = await one(
    `INSERT INTO transactions (${TX_COLUMNS.join(', ')}) VALUES (${TX_COLUMNS.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING id`,
    TX_COLUMNS.map((c) => row[c]),
    client
  );
  return id;
}

const getTx = (id) => one('SELECT * FROM transactions WHERE id = $1', [Number(id) || 0]);
const setTxStatus = (status, id) => q('UPDATE transactions SET status = $1 WHERE id = $2', [status, id]);

async function approveDeposit(txId) {
  const tx = await getTx(txId);
  if (!tx) throw new Error('Transaction not found');
  if (tx.status === 'approved') return tx;
  await setTxStatus('approved', tx.id);
  await sendMemberEmail('received', await getMember(tx.member_id), tx);
  await checkBalanceAlert(tx.member_id);
  return getTx(txId);
}

// ---------------- Dashboard ----------------

app.get('/api/summary', requireAdmin, wrap(async (req, res) => {
  const members = await listMembers();
  const threshold = Number((await getSettings()).low_balance_threshold || 0);
  const totals = await one(`
    SELECT
      COALESCE(SUM(CASE WHEN type='deposit' AND status='approved' THEN amount END),0) AS collected,
      COALESCE(SUM(CASE WHEN type='expense' AND status='approved' THEN amount END),0) AS spent,
      COALESCE(SUM(CASE WHEN type='deposit' AND status='pending'  THEN amount END),0) AS pending_amount,
      COUNT(CASE WHEN type='deposit' AND status='pending' THEN 1 END)::int AS pending_count
    FROM transactions
  `);
  const monthly = (await q(`
    SELECT substr(created_at,1,7) AS month,
      COALESCE(SUM(CASE WHEN type='deposit' AND status='approved' THEN amount END),0) AS collected,
      COALESCE(SUM(CASE WHEN type='expense' AND status='approved' THEN amount END),0) AS spent
    FROM transactions GROUP BY month ORDER BY month DESC LIMIT 6
  `)).reverse();
  const recent = await q(`
    SELECT t.*, m.name AS member_name FROM transactions t JOIN members m ON m.id = t.member_id
    ORDER BY t.id DESC LIMIT 10
  `);
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
}));

// ---------------- Members ----------------

app.get('/api/members', requireAdmin, wrap(async (req, res) => {
  res.json(await listMembers({ includeInactive: req.query.all === '1' }));
}));

app.post('/api/members', requireAdmin, wrap(async (req, res) => {
  const { name, email, phone, department, opening_balance } = req.body;
  if (!name || !email) throw new Error('Name and email are required');
  const { id } = await one('INSERT INTO members (name, email, phone, department, token) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name.trim(), email.trim(), phone || null, department || null, newToken()]);
  if (Number(opening_balance) > 0) {
    await addTx({ member_id: id, type: 'deposit', amount: positiveAmount(opening_balance), method: 'cash', note: 'Opening balance' });
  }
  res.json(await getMember(id));
}));

app.put('/api/members/:id', requireAdmin, wrap(async (req, res) => {
  const m = await getMember(req.params.id);
  if (!m) throw new Error('Member not found');
  const { name = m.name, email = m.email, phone = m.phone, department = m.department, active = m.active } = req.body;
  await q('UPDATE members SET name=$1, email=$2, phone=$3, department=$4, active=$5 WHERE id=$6',
    [name, email, phone || null, department || null, active ? 1 : 0, m.id]);
  res.json(await getMember(m.id));
}));

app.delete('/api/members/:id', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0;
  if (await one('SELECT 1 FROM transactions WHERE member_id = $1 LIMIT 1', [id])) {
    await q('UPDATE members SET active = 0 WHERE id = $1', [id]);
    return res.json({ ok: true, deactivated: true });
  }
  await q('DELETE FROM members WHERE id = $1', [id]);
  res.json({ ok: true });
}));

app.get('/api/members/:id/transactions', requireAdmin, wrap(async (req, res) => {
  res.json(await q('SELECT * FROM transactions WHERE member_id = $1 ORDER BY id DESC', [Number(req.params.id) || 0]));
}));

app.post('/api/members/:id/remind', requireAdmin, wrap(async (req, res) => {
  const m = await getMember(req.params.id);
  if (!m) throw new Error('Member not found');
  const threshold = Number((await getSettings()).low_balance_threshold || 0);
  const kind = m.balance <= 0 ? 'empty' : m.balance <= threshold ? 'low' : 'statement';
  res.json(await sendMemberEmail(kind, m));
}));

app.post('/api/members/:id/regenerate-link', requireAdmin, wrap(async (req, res) => {
  await q('UPDATE members SET token = $1 WHERE id = $2', [newToken(), Number(req.params.id) || 0]);
  res.json(await getMember(req.params.id));
}));

// ---------------- Transactions ----------------

app.get('/api/transactions', requireAdmin, wrap(async (req, res) => {
  const filters = [];
  const params = [];
  if (req.query.status) { params.push(req.query.status); filters.push(`t.status = $${params.length}`); }
  if (req.query.type) { params.push(req.query.type); filters.push(`t.type = $${params.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  res.json(await q(`
    SELECT t.*, m.name AS member_name FROM transactions t JOIN members m ON m.id = t.member_id
    ${where} ORDER BY t.id DESC LIMIT 500
  `, params));
}));

// Admin records a cash deposit, a manual expense, or an adjustment
app.post('/api/transactions', requireAdmin, wrap(async (req, res) => {
  const { member_id, type, amount, method, reference, note } = req.body;
  if (!(await getMember(member_id))) throw new Error('Member not found');
  if (!['deposit', 'expense'].includes(type)) throw new Error('Invalid type');
  const id = await addTx({ member_id: Number(member_id), type, amount: positiveAmount(amount), method: method || (type === 'deposit' ? 'cash' : 'adjustment'), reference, note });
  if (type === 'deposit') await sendMemberEmail('received', await getMember(member_id), await getTx(id));
  await checkBalanceAlert(member_id);
  res.json(await getTx(id));
}));

app.post('/api/transactions/:id/approve', requireAdmin, wrap(async (req, res) => {
  res.json(await approveDeposit(req.params.id));
}));

app.post('/api/transactions/:id/reject', requireAdmin, wrap(async (req, res) => {
  const tx = await getTx(req.params.id);
  if (!tx) throw new Error('Transaction not found');
  await setTxStatus('rejected', tx.id);
  await checkBalanceAlert(tx.member_id);
  res.json(await getTx(tx.id));
}));

app.delete('/api/transactions/:id', requireAdmin, wrap(async (req, res) => {
  const tx = await getTx(req.params.id);
  if (!tx) throw new Error('Transaction not found');
  await q('DELETE FROM transactions WHERE id = $1', [tx.id]);
  await checkBalanceAlert(tx.member_id);
  res.json({ ok: true });
}));

// ---------------- Lunches ----------------

app.get('/api/lunches', requireAdmin, wrap(async (req, res) => {
  res.json(await q('SELECT * FROM lunches ORDER BY date DESC, id DESC LIMIT 200'));
}));

// Body: { date, description, member_ids: [], per_person } OR { ..., total } to split equally
app.post('/api/lunches', requireAdmin, wrap(async (req, res) => {
  const { date, description, member_ids, per_person, total } = req.body;
  if (!date) throw new Error('Date is required');
  const requested = [...new Set((member_ids || []).map(Number))];
  const ids = (await q('SELECT id FROM members WHERE id = ANY($1::int[])', [requested])).map((r) => r.id);
  if (!ids.length) throw new Error('Select at least one member');
  const each = per_person ? positiveAmount(per_person) : round2(positiveAmount(total) / ids.length);
  const lunchTotal = per_person ? round2(each * ids.length) : positiveAmount(total);

  const lunchId = await transaction(async (client) => {
    const { id } = await one('INSERT INTO lunches (date, description, total, per_person, headcount) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [date, description || null, lunchTotal, each, ids.length], client);
    for (const memberId of ids) {
      await addTx({ member_id: memberId, type: 'expense', amount: each, method: 'lunch', note: `Lunch ${date}${description ? ' - ' + description : ''}`, lunch_id: id }, client);
    }
    return id;
  });
  for (const id of ids) await checkBalanceAlert(id);
  res.json({ id: lunchId, per_person: each, total: lunchTotal, headcount: ids.length });
}));

app.delete('/api/lunches/:id', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0;
  const memberIds = (await q('SELECT member_id FROM transactions WHERE lunch_id = $1', [id])).map((r) => r.member_id);
  await q('DELETE FROM lunches WHERE id = $1', [id]);
  for (const memberId of memberIds) await checkBalanceAlert(memberId);
  res.json({ ok: true });
}));

// ---------------- Settings & email log ----------------

app.get('/api/settings', requireAdmin, wrap(async (req, res) => res.json(await getSettings())));
app.put('/api/settings', requireAdmin, wrap(async (req, res) => {
  await saveSettings(req.body);
  res.json(await getSettings());
}));

app.get('/api/emails', requireAdmin, wrap(async (req, res) => {
  res.json(await q(`
    SELECT e.*, m.name AS member_name FROM emails e LEFT JOIN members m ON m.id = e.member_id
    ORDER BY e.id DESC LIMIT 200
  `));
}));

// ---------------- Public member payment page ----------------

async function publicMember(req) {
  const m = await getMemberByToken(req.params.token);
  if (!m) throw new Error('Invalid or expired payment link');
  return m;
}

app.get('/api/public/:token', wrap(async (req, res) => {
  const m = await publicMember(req);
  const s = await getSettings();
  const history = await q('SELECT type, amount, method, status, note, created_at FROM transactions WHERE member_id = $1 ORDER BY id DESC LIMIT 15', [m.id]);
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
  const m = await publicMember(req);
  const { method, amount, reference } = req.body;
  if (!['jazzcash', 'meezan'].includes(method)) throw new Error('Invalid payment method');
  if (!reference || String(reference).trim().length < 4) throw new Error('Please enter the transaction ID / reference number');
  const id = await addTx({ member_id: m.id, type: 'deposit', amount: positiveAmount(amount), method, reference: String(reference).trim(), status: 'pending', note: 'Submitted by member' });
  res.json({ ok: true, id });
}));

app.post('/api/public/:token/jazzcash', wrap(async (req, res) => {
  if (!pay.jazzcashEnabled) throw new Error('JazzCash online payment is not configured');
  const m = await publicMember(req);
  const amount = positiveAmount(req.body.amount);
  const txnRef = 'T' + Date.now() + crypto.randomBytes(2).toString('hex');
  await addTx({ member_id: m.id, type: 'deposit', amount, method: 'jazzcash', gateway_ref: txnRef, status: 'pending', note: 'JazzCash online (awaiting confirmation)' });
  res.json(pay.jazzcashCheckout({ txnRef, amount, memberName: m.name, returnUrl: `${baseUrl(req)}/api/payments/jazzcash/return` }));
}));

app.post('/api/public/:token/meezan', wrap(async (req, res) => {
  if (!pay.meezanEnabled) throw new Error('Meezan Bank online payment is not configured');
  const m = await publicMember(req);
  const amount = positiveAmount(req.body.amount);
  const orderNumber = 'M' + Date.now() + crypto.randomBytes(2).toString('hex');
  const result = await pay.meezanRegister({
    orderNumber,
    amount,
    returnUrl: `${baseUrl(req)}/api/payments/meezan/return`,
    description: `Lunch budget top-up - ${m.name}`,
  });
  await addTx({ member_id: m.id, type: 'deposit', amount, method: 'meezan', gateway_ref: orderNumber, reference: result.orderId, status: 'pending', note: 'Meezan online (awaiting confirmation)' });
  res.json({ redirect: result.formUrl });
}));

const txByGatewayRef = (ref) => one(`
  SELECT t.*, m.token FROM transactions t JOIN members m ON m.id = t.member_id WHERE t.gateway_ref = $1
`, [String(ref)]);

function backToPayPage(res, token, status, message) {
  const params = new URLSearchParams({ m: token || '', status, message: message || '' });
  res.redirect(`/pay.html?${params}`);
}

// JazzCash POSTs the result back to this URL
app.post('/api/payments/jazzcash/return', wrap(async (req, res) => {
  const result = pay.jazzcashVerify(req.body);
  const tx = result.txnRef && (await txByGatewayRef(result.txnRef));
  if (!tx) return res.status(404).send('Unknown transaction');
  if (!result.valid) return backToPayPage(res, tx.token, 'failed', 'Payment verification failed');
  if (result.success) {
    await approveDeposit(tx.id);
    return backToPayPage(res, tx.token, 'success', 'Payment received via JazzCash');
  }
  await setTxStatus('rejected', tx.id);
  backToPayPage(res, tx.token, 'failed', result.message || 'Payment was not completed');
}));

// Meezan redirects the browser here with ?orderId=...
app.get('/api/payments/meezan/return', wrap(async (req, res) => {
  const status = await pay.meezanStatus(String(req.query.orderId || ''));
  const tx = status.orderNumber && (await txByGatewayRef(status.orderNumber));
  if (!tx) return res.status(404).send('Unknown transaction');
  if (status.paid) {
    await approveDeposit(tx.id);
    return backToPayPage(res, tx.token, 'success', 'Payment received via Meezan Bank');
  }
  await setTxStatus('rejected', tx.id);
  backToPayPage(res, tx.token, 'failed', 'Payment was not completed');
}));

// ---------------- Static ----------------

app.use(express.static(path.join(__dirname, 'public')));

// Vercel imports the app; locally we start a server.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Lunch budget running at http://localhost:${PORT}`);
    console.log(`Email: ${emailConfigured ? 'SMTP configured' : 'NOT configured (emails are only logged)'}`);
    console.log(`JazzCash online: ${pay.jazzcashEnabled ? 'on' : 'off'} · Meezan online: ${pay.meezanEnabled ? 'on' : 'off'}`);
    if (!process.env.ADMIN_PASSWORD) console.log('WARNING: ADMIN_PASSWORD not set, using "admin"');
  });
}

module.exports = app;
