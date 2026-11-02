const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let settings = { currency: 'Rs', low_balance_threshold: 500 };
let members = [];

// ---------------- Utils ----------------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  return `${settings.currency} ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = ''), 3200);
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && url !== '/api/login') {
    showLogin();
    throw new Error('Login required');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function statusBadge(m) {
  if (!m.active) return '<span class="badge muted">Inactive</span>';
  if (m.balance <= 0) return '<span class="badge empty">Finished</span>';
  if (m.balance <= Number(settings.low_balance_threshold)) return '<span class="badge low">Low</span>';
  return '<span class="badge ok">OK</span>';
}

function payLink(m) {
  return `${location.origin}/pay.html?m=${m.token}`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function modal(title, bodyHtml, onSubmit, submitLabel = 'Save') {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-bg">
      <form class="modal">
        <h2>${esc(title)}</h2>
        ${bodyHtml}
        <div class="modal-foot">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          ${onSubmit ? `<button class="btn">${esc(submitLabel)}</button>` : ''}
        </div>
      </form>
    </div>`;
  const close = () => (root.innerHTML = '');
  $('[data-close]', root).onclick = close;
  $('.modal-bg', root).onclick = (e) => e.target.classList.contains('modal-bg') && close();
  $('form', root).onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('form .btn:not(.secondary)', root);
    if (btn) btn.disabled = true;
    try {
      await onSubmit(formData(e.target));
      close();
    } catch (err) {
      toast(err.message, true);
      if (btn) btn.disabled = false;
    }
  };
  $('input, select', root)?.focus();
  return root;
}

// ---------------- Auth ----------------

function showLogin() {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#password').focus();
}

$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#password').value } });
    $('#password').value = '';
    start();
  } catch (err) {
    toast(err.message, true);
  }
};

$('#logout').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
};

// ---------------- Navigation ----------------

const loaders = {
  overview: loadOverview,
  members: loadMembers,
  lunch: loadLunch,
  payments: loadPayments,
  emails: loadEmails,
  settings: loadSettings,
};
let currentPage = 'overview';

function go(page) {
  currentPage = page;
  $$('.nav-btn[data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  $$('[data-section]').forEach((s) => s.classList.toggle('hidden', s.dataset.section !== page));
  loaders[page]().catch((err) => toast(err.message, true));
}

$$('.nav-btn[data-page]').forEach((b) => (b.onclick = () => go(b.dataset.page)));

async function refreshCommon() {
  settings = await api('/api/settings');
  $('#brand-name').textContent = settings.company_name || 'Lunch Budget';
  const pending = await api('/api/transactions?status=pending');
  const pill = $('#pending-pill');
  pill.textContent = pending.length;
  pill.classList.toggle('hidden', !pending.length);
}

async function start() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await refreshCommon();
  go(currentPage);
}

// ---------------- Overview ----------------

async function loadOverview() {
  const s = await api('/api/summary');
  $('#s-collected').textContent = money(s.collected);
  $('#s-spent').textContent = money(s.spent);
  $('#s-balance').textContent = money(s.balance);
  $('#s-members').textContent = s.member_count;
  $('#s-pending').textContent = s.pending_count ? `${s.pending_count} · ${money(s.pending_amount)}` : '0';

  const notes = [];
  if (!s.config.email) notes.push('Email (SMTP) is not configured in <code>.env</code>, so alert emails are only logged, not sent.');
  if (!s.config.jazzcash) notes.push('JazzCash online checkout is off; members can still pay manually and enter their TID.');
  if (!s.config.meezan) notes.push('Meezan online gateway is off; members can still transfer to the bank account and enter the reference.');
  $('#config-notice').innerHTML = notes.length ? `<div class="notice">${notes.join('<br>')}</div>` : '';

  const alerts = [...s.empty, ...s.low];
  $('#alerts-body').innerHTML = alerts.length
    ? alerts.map((m) => `
      <tr>
        <td>${esc(m.name)} ${statusBadge(m)}</td>
        <td class="num ${m.balance <= 0 ? 'neg' : ''}">${money(m.balance)}</td>
        <td class="num"><button class="btn sm secondary" data-remind="${m.id}">Send email</button></td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="empty-row">Everyone has enough balance 🎉</td></tr>';
  $$('[data-remind]').forEach((b) => (b.onclick = () => remind(b.dataset.remind, b)));

  const max = Math.max(1, ...s.monthly.flatMap((m) => [m.collected, m.spent]));
  $('#chart').innerHTML = s.monthly.length
    ? s.monthly.map((m) => `
      <div class="bar-group" title="${m.month}: collected ${money(m.collected)}, spent ${money(m.spent)}">
        <div class="bar-pair">
          <div class="bar in" style="height:${(m.collected / max) * 100}%"></div>
          <div class="bar out" style="height:${(m.spent / max) * 100}%"></div>
        </div>
        <div class="bar-label">${new Date(m.month + '-01').toLocaleString('en', { month: 'short' })}</div>
      </div>`).join('')
    : '<p class="muted">No data yet</p>';

  $('#recent-body').innerHTML = txRows(s.recent, { actions: false });
}

async function remind(id, btn) {
  btn.disabled = true;
  try {
    const r = await api(`/api/members/${id}/remind`, { method: 'POST' });
    toast(r.status === 'sent' ? 'Email sent' : r.status === 'logged' ? 'SMTP not configured, email logged only' : 'Email failed: ' + r.error, r.status === 'failed');
  } catch (err) {
    toast(err.message, true);
  }
  btn.disabled = false;
}

// ---------------- Members ----------------

async function loadMembers() {
  members = await api('/api/members' + ($('#show-inactive').checked ? '?all=1' : ''));
  renderMembers();
}

function renderMembers() {
  const q = $('#member-search').value.toLowerCase();
  const list = members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  $('#members-body').innerHTML = list.length
    ? list.map((m) => `
      <tr>
        <td><b>${esc(m.name)}</b>${m.department ? `<br><small class="muted">${esc(m.department)}</small>` : ''}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.phone || '')}</td>
        <td class="num">${money(m.deposited)}${m.pending ? `<br><small class="muted">+${money(m.pending)} pending</small>` : ''}</td>
        <td class="num">${money(m.spent)}</td>
        <td class="num ${m.balance <= 0 ? 'neg' : 'pos'}">${money(m.balance)}</td>
        <td>${statusBadge(m)}</td>
        <td><div class="actions">
          <button class="btn sm" data-act="deposit" data-id="${m.id}">+ Money</button>
          <button class="btn sm secondary" data-act="history" data-id="${m.id}">History</button>
          <button class="btn sm secondary" data-act="link" data-id="${m.id}">Pay link</button>
          <button class="btn sm secondary" data-act="remind" data-id="${m.id}">Email</button>
          <button class="btn sm secondary" data-act="edit" data-id="${m.id}">Edit</button>
        </div></td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty-row">No members yet. Click "+ Add member".</td></tr>';

  $$('#members-body [data-act]').forEach((b) => {
    const m = members.find((x) => x.id == b.dataset.id);
    b.onclick = () => ({
      deposit: () => txModal(m.id, 'deposit'),
      history: () => historyModal(m),
      link: () => linkModal(m),
      remind: () => remind(m.id, b),
      edit: () => memberModal(m),
    })[b.dataset.act]();
  });
}

$('#member-search').oninput = renderMembers;
$('#show-inactive').onchange = loadMembers;
$('#add-member-btn').onclick = () => memberModal();

function memberModal(m) {
  const isNew = !m;
  m = m || {};
  modal(isNew ? 'Add member' : 'Edit member', `
    <div class="form-grid">
      <div class="field"><label>Name *</label><input name="name" required value="${esc(m.name)}"></div>
      <div class="field"><label>Email *</label><input name="email" type="email" required value="${esc(m.email)}"></div>
      <div class="field"><label>Phone</label><input name="phone" value="${esc(m.phone)}"></div>
      <div class="field"><label>Department</label><input name="department" value="${esc(m.department)}"></div>
      ${isNew
        ? '<div class="field"><label>Opening deposit (cash)</label><input name="opening_balance" type="number" min="0" step="any" placeholder="0"></div>'
        : `<div class="field"><label>Status</label><select name="active">
            <option value="1" ${m.active ? 'selected' : ''}>Active</option>
            <option value="" ${!m.active ? 'selected' : ''}>Inactive</option></select></div>`}
    </div>
    ${isNew ? '' : `<button type="button" class="btn sm danger" id="del-member">Remove member</button>`}
  `, async (data) => {
    if (isNew) await api('/api/members', { method: 'POST', body: data });
    else await api(`/api/members/${m.id}`, { method: 'PUT', body: { ...data, active: Boolean(data.active) } });
    toast(isNew ? 'Member added' : 'Member updated');
    loadMembers();
  });
  const del = $('#del-member');
  if (del) del.onclick = async () => {
    if (!confirm(`Remove ${m.name}? Members with history are deactivated instead of deleted.`)) return;
    const r = await api(`/api/members/${m.id}`, { method: 'DELETE' });
    $('#modal-root').innerHTML = '';
    toast(r.deactivated ? 'Member deactivated (history kept)' : 'Member deleted');
    loadMembers();
  };
}

function txModal(memberId, type = 'deposit') {
  const opts = members.filter((m) => m.active).map((m) => `<option value="${m.id}" ${m.id == memberId ? 'selected' : ''}>${esc(m.name)} (${money(m.balance)})</option>`).join('');
  modal('Record payment', `
    <div class="field"><label>Member</label><select name="member_id" required>${opts}</select></div>
    <div class="form-grid">
      <div class="field"><label>Type</label><select name="type">
        <option value="deposit" ${type === 'deposit' ? 'selected' : ''}>Deposit (money received)</option>
        <option value="expense" ${type === 'expense' ? 'selected' : ''}>Expense / deduction</option>
      </select></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" min="1" step="any" required></div>
      <div class="field"><label>Method</label><select name="method">
        <option value="cash">Cash</option>
        <option value="jazzcash">JazzCash</option>
        <option value="meezan">Meezan Bank</option>
        <option value="adjustment">Adjustment</option>
      </select></div>
      <div class="field"><label>Reference / TID</label><input name="reference"></div>
    </div>
    <div class="field"><label>Note</label><input name="note"></div>
  `, async (data) => {
    await api('/api/transactions', { method: 'POST', body: data });
    toast('Saved');
    refreshCommon();
    loaders[currentPage]();
  });
}

async function historyModal(m) {
  const txs = await api(`/api/members/${m.id}/transactions`);
  modal(`${m.name} · ${money(m.balance)} left`, `
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Detail</th><th class="num">Amount</th><th>Status</th></tr></thead>
      <tbody>${txs.length ? txs.map((t) => `
        <tr>
          <td>${esc(t.created_at.slice(0, 10))}</td>
          <td>${esc(t.note || t.method || '')}${t.reference ? `<br><small class="muted">Ref: ${esc(t.reference)}</small>` : ''}</td>
          <td class="num ${t.type === 'expense' ? 'neg' : 'pos'}">${t.type === 'expense' ? '−' : '+'}${money(t.amount)}</td>
          <td><span class="badge ${t.status}">${t.status}</span></td>
        </tr>`).join('') : '<tr><td colspan="4" class="empty-row">No transactions</td></tr>'}
      </tbody>
    </table></div>
  `);
}

function linkModal(m) {
  modal(`Payment link for ${m.name}`, `
    <p class="muted">Share this private link with ${esc(m.name)}. They can see their balance and pay via JazzCash or Meezan Bank. The link is also included in every alert email.</p>
    <div class="field"><input readonly value="${esc(payLink(m))}" id="link-input"></div>
    <div class="actions">
      <button type="button" class="btn" id="copy-link">Copy link</button>
      <a class="btn secondary" style="text-decoration:none" target="_blank" href="${esc(payLink(m))}">Open</a>
      <button type="button" class="btn secondary" id="regen-link">Generate new link</button>
    </div>
  `);
  $('#copy-link').onclick = async () => {
    await navigator.clipboard.writeText($('#link-input').value);
    toast('Link copied');
  };
  $('#regen-link').onclick = async () => {
    if (!confirm('The old link will stop working. Continue?')) return;
    const updated = await api(`/api/members/${m.id}/regenerate-link`, { method: 'POST' });
    $('#link-input').value = payLink(updated);
    loadMembers();
  };
}

// ---------------- Lunch ----------------

async function loadLunch() {
  members = await api('/api/members');
  const form = $('#lunch-form');
  if (!form.date.value) form.date.value = new Date().toISOString().slice(0, 10);
  if (!form.amount.value) form.amount.value = settings.default_lunch_cost || '';
  $('#lunch-members').innerHTML = members.length
    ? members.map((m) => `
      <label class="check-item">
        <input type="checkbox" value="${m.id}" checked>
        ${esc(m.name)}
        <small class="${m.balance <= 0 ? 'neg' : ''}">${money(m.balance)}</small>
      </label>`).join('')
    : '<p class="muted">Add members first.</p>';
  updateLunchPreview();

  const lunches = await api('/api/lunches');
  $('#lunches-body').innerHTML = lunches.length
    ? lunches.map((l) => `
      <tr>
        <td>${esc(l.date)}</td><td>${esc(l.description || '')}</td>
        <td class="num">${l.headcount}</td><td class="num">${money(l.per_person)}</td><td class="num">${money(l.total)}</td>
        <td><button class="btn sm secondary" data-del-lunch="${l.id}">Delete</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty-row">No lunches recorded yet</td></tr>';
  $$('[data-del-lunch]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this lunch and refund everyone?')) return;
    await api(`/api/lunches/${b.dataset.delLunch}`, { method: 'DELETE' });
    toast('Lunch deleted and refunded');
    loadLunch();
  }));
}

function selectedLunchMembers() {
  return $$('#lunch-members input:checked').map((i) => Number(i.value));
}

function updateLunchPreview() {
  const form = $('#lunch-form');
  const ids = selectedLunchMembers();
  const amount = Number(form.amount.value) || 0;
  const perPerson = form.mode.value === 'per_person';
  $('#amount-label').textContent = perPerson ? 'Amount per person' : 'Total bill';
  $('#selected-count').textContent = `(${ids.length} selected)`;
  if (!ids.length || !amount) return ($('#lunch-preview').textContent = '');
  const each = perPerson ? amount : amount / ids.length;
  $('#lunch-preview').textContent = `${ids.length} people × ${money(each)} = ${money(each * ids.length)} will be deducted.`;
}

$('#lunch-form').addEventListener('input', updateLunchPreview);
$('#lunch-members').addEventListener('change', updateLunchPreview);
$('#select-all').onclick = () => { $$('#lunch-members input').forEach((i) => (i.checked = true)); updateLunchPreview(); };
$('#select-none').onclick = () => { $$('#lunch-members input').forEach((i) => (i.checked = false)); updateLunchPreview(); };

$('#lunch-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = formData(e.target);
  const body = { date: f.date, description: f.description, member_ids: selectedLunchMembers() };
  body[f.mode === 'per_person' ? 'per_person' : 'total'] = f.amount;
  try {
    const r = await api('/api/lunches', { method: 'POST', body });
    toast(`Lunch saved: ${r.headcount} × ${money(r.per_person)} deducted`);
    e.target.description.value = '';
    loadLunch();
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------------- Payments ----------------

function txRows(txs, { actions = true } = {}) {
  const cols = actions ? 8 : 6;
  if (!txs.length) return `<tr><td colspan="${cols}" class="empty-row">Nothing here</td></tr>`;
  return txs.map((t) => `
    <tr>
      <td>${esc(t.created_at.slice(0, 16))}</td>
      <td>${esc(t.member_name)}</td>
      <td>${t.type === 'deposit' ? 'Deposit' : 'Expense'}</td>
      <td>${esc(t.method || '')}</td>
      ${actions ? `<td>${esc(t.reference || '')}</td>` : ''}
      <td class="num ${t.type === 'expense' ? 'neg' : 'pos'}">${t.type === 'expense' ? '−' : '+'}${money(t.amount)}</td>
      <td><span class="badge ${t.status}">${t.status}</span></td>
      ${actions ? `<td><div class="actions">
        ${t.status === 'pending' ? `
          <button class="btn sm" data-tx="approve" data-id="${t.id}">Approve</button>
          <button class="btn sm secondary" data-tx="reject" data-id="${t.id}">Reject</button>` : ''}
        ${t.lunch_id ? '' : `<button class="btn sm secondary" data-tx="delete" data-id="${t.id}">Delete</button>`}
      </div></td>` : ''}
    </tr>`).join('');
}

async function loadPayments() {
  members = await api('/api/members');
  const f = $('#tx-filter').value;
  const q = f === 'pending' ? '?status=pending' : f ? `?type=${f}` : '';
  const txs = await api('/api/transactions' + q);
  $('#tx-body').innerHTML = txRows(txs);
  $$('#tx-body [data-tx]').forEach((b) => (b.onclick = async () => {
    const act = b.dataset.tx;
    if (act === 'delete' && !confirm('Delete this transaction?')) return;
    try {
      if (act === 'delete') await api(`/api/transactions/${b.dataset.id}`, { method: 'DELETE' });
      else await api(`/api/transactions/${b.dataset.id}/${act}`, { method: 'POST' });
      toast(act === 'approve' ? 'Approved, receipt emailed' : act === 'reject' ? 'Rejected' : 'Deleted');
      refreshCommon();
      loadPayments();
    } catch (err) {
      toast(err.message, true);
    }
  }));
}

$('#tx-filter').onchange = loadPayments;
$('#add-tx-btn').onclick = () => txModal(null);

// ---------------- Emails ----------------

async function loadEmails() {
  const rows = await api('/api/emails');
  const cls = { sent: 'approved', failed: 'empty', logged: 'pending' };
  $('#emails-body').innerHTML = rows.length
    ? rows.map((e) => `
      <tr>
        <td>${esc(e.created_at.slice(0, 16))}</td><td>${esc(e.member_name || '')}</td><td>${esc(e.to_addr)}</td>
        <td>${esc(e.subject)}</td>
        <td><span class="badge ${cls[e.status]}" title="${esc(e.error || '')}">${e.status}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty-row">No emails yet</td></tr>';
}

// ---------------- Settings ----------------

async function loadSettings() {
  settings = await api('/api/settings');
  const form = $('#settings-form');
  for (const [k, v] of Object.entries(settings)) if (form[k]) form[k].value = v ?? '';
  const s = await api('/api/summary');
  $('#gateway-status').innerHTML =
    `Online checkout: JazzCash <b>${s.config.jazzcash ? 'ON' : 'OFF'}</b> · Meezan <b>${s.config.meezan ? 'ON' : 'OFF'}</b> · Email <b>${s.config.email ? 'ON' : 'OFF'}</b><br>` +
    'Gateway and SMTP credentials are set in the <code>.env</code> file on the server.';
}

$('#settings-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    settings = await api('/api/settings', { method: 'PUT', body: formData(e.target) });
    $('#brand-name').textContent = settings.company_name;
    toast('Settings saved');
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------------- Boot ----------------

api('/api/me').then(start).catch(() => showLogin());
