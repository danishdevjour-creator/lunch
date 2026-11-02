const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let settings = { currency: 'Rs', low_balance_threshold: 500 };
let members = [];
let loggedIn = false;

// ---------------- Utils ----------------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n, sign = '') {
  return ltr(`${sign}${settings.currency} ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`);
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = ''), 3200);
}

const toastError = (err) => toast(tMsg(err.message), true);

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
  if (!m.active) return `<span class="badge muted">${t('status.inactive')}</span>`;
  if (m.balance <= 0) return `<span class="badge empty">${t('status.finished')}</span>`;
  if (m.balance <= Number(settings.low_balance_threshold)) return `<span class="badge low">${t('status.low')}</span>`;
  return `<span class="badge ok">${t('status.ok')}</span>`;
}

const txStatus = (status) => `<span class="badge ${status}">${t('status.' + status)}</span>`;
const methodLabel = (method) => (method ? t('method.' + method) : '');

function payLink(m) {
  return `${location.origin}/pay.html?m=${m.token}`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function modal(title, bodyHtml, onSubmit, submitLabel = t('btn.save')) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-bg">
      <form class="modal" role="dialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        ${bodyHtml}
        <div class="modal-foot">
          <button type="button" class="btn secondary" data-close>${t('btn.cancel')}</button>
          ${onSubmit ? `<button class="btn">${esc(submitLabel)}</button>` : ''}
        </div>
      </form>
    </div>`;
  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  $('[data-close]', root).onclick = close;
  // Block body on purpose: an onclick handler returning false cancels the click (and the Save submit).
  $('.modal-bg', root).onclick = (e) => {
    if (e.target.classList.contains('modal-bg')) close();
  };
  $('form', root).onsubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = $('form .btn:not(.secondary)', root);
    if (btn) btn.disabled = true;
    try {
      await onSubmit(formData(e.target));
      close();
    } catch (err) {
      toastError(err);
      if (btn) btn.disabled = false;
    }
  };
  $('.modal input, .modal select', root)?.focus();
  return root;
}

// ---------------- Header: auth button, mobile menu, language, theme ----------------

function renderAuthButton() {
  $('#auth-label').textContent = loggedIn ? t('auth.logout') : t('auth.login');
  $('#auth-btn').setAttribute('aria-label', loggedIn ? t('auth.logout') : t('auth.login'));
  $('#menu').classList.toggle('hidden', !loggedIn);
  $('#menu-toggle').classList.toggle('hidden', !loggedIn);
}

$('#auth-btn').onclick = async () => {
  if (!loggedIn) {
    showLogin();
    return;
  }
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  showLogin();
};

function closeMobileMenu() {
  $('#menu').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}

$('#menu-toggle').onclick = () => {
  const open = $('#menu').classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
};

$('#logo-link').onclick = (e) => {
  e.preventDefault();
  if (loggedIn) go('overview');
};

setupChrome({
  onLangChange: () => {
    renderAuthButton();
    if (loggedIn) loaders[currentPage]().catch(toastError);
  },
});

// ---------------- Auth ----------------

function showLogin() {
  loggedIn = false;
  renderAuthButton();
  closeMobileMenu();
  $('#modal-root').innerHTML = '';
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
    toastError(err);
  }
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
  closeMobileMenu();
  $$('.nav-btn[data-page]').forEach((b) => {
    b.classList.toggle('active', b.dataset.page === page);
    if (b.dataset.page === page) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $$('[data-section]').forEach((s) => s.classList.toggle('hidden', s.dataset.section !== page));
  window.scrollTo({ top: 0 });
  loaders[page]().catch(toastError);
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
  loggedIn = true;
  renderAuthButton();
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  try {
    await refreshCommon();
  } catch (err) {
    toastError(err);
  }
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
  if (!s.config.email) notes.push(t('notice.email'));
  if (!s.config.jazzcash) notes.push(t('notice.jazzcash'));
  if (!s.config.meezan) notes.push(t('notice.meezan'));
  $('#config-notice').innerHTML = notes.length ? `<div class="notice">${notes.map(esc).join('<br>')}</div>` : '';

  const alerts = [...s.empty, ...s.low];
  $('#alerts-body').innerHTML = alerts.length
    ? alerts.map((m) => `
      <tr>
        <td>${esc(m.name)} ${statusBadge(m)}</td>
        <td class="num ${m.balance <= 0 ? 'neg' : ''}">${money(m.balance)}</td>
        <td class="num"><button class="btn sm secondary" data-remind="${m.id}">${t('btn.sendEmail')}</button></td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="empty-row">${t('overview.allGood')}</td></tr>`;
  $$('[data-remind]').forEach((b) => (b.onclick = () => remind(b.dataset.remind, b)));

  const max = Math.max(1, ...s.monthly.flatMap((m) => [m.collected, m.spent]));
  $('#chart').innerHTML = s.monthly.length
    ? s.monthly.map((m) => `
      <div class="bar-group" title="${esc(m.month)}: ${t('legend.collected')} ${money(m.collected)}, ${t('legend.spent')} ${money(m.spent)}">
        <div class="bar-pair">
          <div class="bar in" style="height:${(m.collected / max) * 100}%"></div>
          <div class="bar out" style="height:${(m.spent / max) * 100}%"></div>
        </div>
        <div class="bar-label">${new Date(m.month + '-01T00:00:00').toLocaleString(locale(), { month: 'short' })}</div>
      </div>`).join('')
    : `<p class="muted">${t('chart.noData')}</p>`;

  $('#recent-body').innerHTML = txRows(s.recent, { actions: false });
}

async function remind(id, btn) {
  btn.disabled = true;
  try {
    const r = await api(`/api/members/${id}/remind`, { method: 'POST' });
    if (r.status === 'sent') toast(t('toast.emailSent'));
    else if (r.status === 'logged') toast(t('toast.emailLogged'));
    else toast(t('toast.emailFailed', { error: r.error }), true);
  } catch (err) {
    toastError(err);
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
        <td dir="ltr">${esc(m.phone || '')}</td>
        <td class="num">${money(m.deposited)}${m.pending ? `<br><small class="muted">${t('members.pending', { amount: money(m.pending, '+') })}</small>` : ''}</td>
        <td class="num">${money(m.spent)}</td>
        <td class="num ${m.balance <= 0 ? 'neg' : 'pos'}">${money(m.balance)}</td>
        <td>${statusBadge(m)}</td>
        <td><div class="actions">
          <button class="btn sm" data-act="deposit" data-id="${m.id}">${t('btn.addMoney')}</button>
          <button class="btn sm secondary" data-act="history" data-id="${m.id}">${t('btn.history')}</button>
          <button class="btn sm secondary" data-act="link" data-id="${m.id}">${t('btn.payLink')}</button>
          <button class="btn sm secondary" data-act="remind" data-id="${m.id}">${t('btn.email')}</button>
          <button class="btn sm secondary" data-act="edit" data-id="${m.id}">${t('btn.edit')}</button>
        </div></td>
      </tr>`).join('')
    : `<tr><td colspan="8" class="empty-row">${t('members.empty')}</td></tr>`;

  $$('#members-body [data-act]').forEach((b) => {
    const m = members.find((x) => x.id == b.dataset.id);
    b.onclick = () => ({
      deposit: () => txModal(m.id, 'deposit'),
      history: () => historyModal(m).catch(toastError),
      link: () => linkModal(m),
      remind: () => remind(m.id, b),
      edit: () => memberModal(m),
    })[b.dataset.act]();
  });
}

$('#member-search').oninput = renderMembers;
$('#show-inactive').onchange = () => loadMembers().catch(toastError);
$('#add-member-btn').onclick = () => memberModal();

function memberModal(m) {
  const isNew = !m;
  m = m || {};
  modal(isNew ? t('member.addTitle') : t('member.editTitle'), `
    <div class="form-grid">
      <div class="field"><label>${t('field.name')}</label><input name="name" required value="${esc(m.name)}"></div>
      <div class="field"><label>${t('field.email')}</label><input name="email" type="email" required dir="ltr" value="${esc(m.email)}"></div>
      <div class="field"><label>${t('field.phone')}</label><input name="phone" dir="ltr" value="${esc(m.phone)}"></div>
      <div class="field"><label>${t('field.department')}</label><input name="department" value="${esc(m.department)}"></div>
      ${isNew
        ? `<div class="field"><label>${t('field.opening')}</label><input name="opening_balance" type="number" min="0" step="any" placeholder="0"></div>`
        : `<div class="field"><label>${t('field.status')}</label><select name="active">
            <option value="1" ${m.active ? 'selected' : ''}>${t('opt.active')}</option>
            <option value="" ${!m.active ? 'selected' : ''}>${t('opt.inactive')}</option></select></div>`}
    </div>
    ${isNew ? '' : `<button type="button" class="btn sm danger" id="del-member">${t('member.remove')}</button>`}
  `, async (data) => {
    if (isNew) await api('/api/members', { method: 'POST', body: data });
    else await api(`/api/members/${m.id}`, { method: 'PUT', body: { ...data, active: Boolean(data.active) } });
    toast(isNew ? t('toast.memberAdded') : t('toast.memberUpdated'));
    loadMembers().catch(toastError);
  });
  const del = $('#del-member');
  if (del) del.onclick = async () => {
    if (!confirm(t('member.removeConfirm', { name: m.name }))) return;
    try {
      const r = await api(`/api/members/${m.id}`, { method: 'DELETE' });
      $('#modal-root').innerHTML = '';
      toast(r.deactivated ? t('toast.memberDeactivated') : t('toast.memberDeleted'));
      loadMembers().catch(toastError);
    } catch (err) {
      toastError(err);
    }
  };
}

async function txModal(memberId, type = 'deposit') {
  if (!members.length) members = await api('/api/members').catch(() => []);
  const opts = members.filter((m) => m.active).map((m) => `<option value="${m.id}" ${m.id == memberId ? 'selected' : ''}>${esc(m.name)} (${money(m.balance)})</option>`).join('');
  modal(t('tx.title'), `
    <div class="field"><label>${t('field.member')}</label><select name="member_id" required>${opts}</select></div>
    <div class="form-grid">
      <div class="field"><label>${t('field.type')}</label><select name="type">
        <option value="deposit" ${type === 'deposit' ? 'selected' : ''}>${t('opt.deposit')}</option>
        <option value="expense" ${type === 'expense' ? 'selected' : ''}>${t('opt.expense')}</option>
      </select></div>
      <div class="field"><label>${t('field.amount')}</label><input name="amount" type="number" min="1" step="any" required></div>
      <div class="field"><label>${t('field.method')}</label><select name="method">
        ${['cash', 'jazzcash', 'meezan', 'adjustment'].map((v) => `<option value="${v}">${methodLabel(v)}</option>`).join('')}
      </select></div>
      <div class="field"><label>${t('field.reference')}</label><input name="reference" dir="ltr"></div>
    </div>
    <div class="field"><label>${t('field.note')}</label><input name="note"></div>
  `, async (data) => {
    await api('/api/transactions', { method: 'POST', body: data });
    toast(t('toast.saved'));
    refreshCommon().catch(() => {});
    loaders[currentPage]().catch(toastError);
  });
}

async function historyModal(m) {
  const txs = await api(`/api/members/${m.id}/transactions`);
  modal(t('history.title', { name: m.name, amount: money(m.balance) }), `
    <div class="table-wrap"><table>
      <thead><tr><th>${t('col.date')}</th><th>${t('col.detail')}</th><th class="num">${t('col.amount')}</th><th>${t('col.status')}</th></tr></thead>
      <tbody>${txs.length ? txs.map((tx) => `
        <tr>
          <td>${ltr(esc(tx.created_at.slice(0, 10)))}</td>
          <td>${esc(tMsg(tx.note) || methodLabel(tx.method))}${tx.reference ? `<br><small class="muted">${esc(t('history.ref', { ref: tx.reference }))}</small>` : ''}</td>
          <td class="num ${tx.type === 'expense' ? 'neg' : 'pos'}">${money(tx.amount, tx.type === 'expense' ? '−' : '+')}</td>
          <td>${txStatus(tx.status)}</td>
        </tr>`).join('') : `<tr><td colspan="4" class="empty-row">${t('history.empty')}</td></tr>`}
      </tbody>
    </table></div>
  `);
}

function linkModal(m) {
  modal(t('link.title', { name: m.name }), `
    <p class="muted">${esc(t('link.help', { name: m.name }))}</p>
    <div class="field"><input readonly dir="ltr" value="${esc(payLink(m))}" id="link-input"></div>
    <div class="actions">
      <button type="button" class="btn" id="copy-link">${t('link.copy')}</button>
      <a class="btn secondary" target="_blank" rel="noopener" id="open-link" href="${esc(payLink(m))}">${t('link.open')}</a>
      <button type="button" class="btn secondary" id="regen-link">${t('link.regen')}</button>
    </div>
  `);
  $('#copy-link').onclick = async () => {
    const input = $('#link-input');
    try {
      await navigator.clipboard.writeText(input.value);
      toast(t('toast.linkCopied'));
    } catch {
      input.select();
      toast(t('toast.copyFailed'), true);
    }
  };
  $('#regen-link').onclick = async () => {
    if (!confirm(t('link.regenConfirm'))) return;
    try {
      const updated = await api(`/api/members/${m.id}/regenerate-link`, { method: 'POST' });
      $('#link-input').value = payLink(updated);
      $('#open-link').href = payLink(updated);
      loadMembers().catch(toastError);
    } catch (err) {
      toastError(err);
    }
  };
}

// ---------------- Lunch ----------------

async function loadLunch() {
  members = await api('/api/members');
  const form = $('#lunch-form');
  if (!form.date.value) form.date.value = new Date().toLocaleDateString('en-CA');
  if (!form.amount.value) form.amount.value = settings.default_lunch_cost || '';
  const previouslyChecked = new Set(selectedLunchMembers());
  const firstLoad = !$('#lunch-members input');
  $('#lunch-members').innerHTML = members.length
    ? members.map((m) => `
      <label class="check-item">
        <input type="checkbox" value="${m.id}" ${firstLoad || previouslyChecked.has(m.id) ? 'checked' : ''}>
        ${esc(m.name)}
        <small class="${m.balance <= 0 ? 'neg' : ''}">${money(m.balance)}</small>
      </label>`).join('')
    : `<p class="muted">${t('lunch.addMembersFirst')}</p>`;
  updateLunchPreview();

  const lunches = await api('/api/lunches');
  $('#lunches-body').innerHTML = lunches.length
    ? lunches.map((l) => `
      <tr>
        <td>${ltr(esc(l.date))}</td><td>${esc(l.description || '')}</td>
        <td class="num">${l.headcount}</td><td class="num">${money(l.per_person)}</td><td class="num">${money(l.total)}</td>
        <td><button class="btn sm secondary" data-del-lunch="${l.id}">${t('btn.delete')}</button></td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty-row">${t('lunch.none')}</td></tr>`;
  $$('[data-del-lunch]').forEach((b) => (b.onclick = async () => {
    if (!confirm(t('lunch.deleteConfirm'))) return;
    try {
      await api(`/api/lunches/${b.dataset.delLunch}`, { method: 'DELETE' });
      toast(t('toast.lunchDeleted'));
      loadLunch().catch(toastError);
    } catch (err) {
      toastError(err);
    }
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
  $('#amount-label').textContent = perPerson ? t('lunch.amountPerPerson') : t('lunch.totalBill');
  $('#selected-count').textContent = t('lunch.selected', { n: ids.length });
  if (!ids.length || !amount) return ($('#lunch-preview').textContent = '');
  const each = perPerson ? amount : amount / ids.length;
  $('#lunch-preview').textContent = t('lunch.preview', { n: ids.length, each: money(each), total: money(each * ids.length) });
}

$('#lunch-form').addEventListener('input', updateLunchPreview);
$('#lunch-form').addEventListener('change', updateLunchPreview);
$('#select-all').onclick = () => { $$('#lunch-members input').forEach((i) => (i.checked = true)); updateLunchPreview(); };
$('#select-none').onclick = () => { $$('#lunch-members input').forEach((i) => (i.checked = false)); updateLunchPreview(); };

$('#lunch-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = formData(e.target);
  const body = { date: f.date, description: f.description, member_ids: selectedLunchMembers() };
  body[f.mode === 'per_person' ? 'per_person' : 'total'] = f.amount;
  const btn = $('button:not([type])', e.target);
  btn.disabled = true;
  try {
    const r = await api('/api/lunches', { method: 'POST', body });
    toast(t('toast.lunchSaved', { n: r.headcount, each: money(r.per_person) }));
    e.target.description.value = '';
    await loadLunch();
  } catch (err) {
    toastError(err);
  }
  btn.disabled = false;
};

// ---------------- Payments ----------------

function txRows(txs, { actions = true } = {}) {
  const cols = actions ? 8 : 6;
  if (!txs.length) return `<tr><td colspan="${cols}" class="empty-row">${t('table.nothing')}</td></tr>`;
  return txs.map((tx) => `
    <tr>
      <td>${ltr(esc(tx.created_at.slice(0, 16)))}</td>
      <td>${esc(tx.member_name)}</td>
      <td>${t('type.' + tx.type)}</td>
      <td>${esc(methodLabel(tx.method))}</td>
      ${actions ? `<td dir="ltr">${esc(tx.reference || '')}</td>` : ''}
      <td class="num ${tx.type === 'expense' ? 'neg' : 'pos'}">${money(tx.amount, tx.type === 'expense' ? '−' : '+')}</td>
      <td>${txStatus(tx.status)}</td>
      ${actions ? `<td><div class="actions">
        ${tx.status === 'pending' ? `
          <button class="btn sm" data-tx="approve" data-id="${tx.id}">${t('btn.approve')}</button>
          <button class="btn sm secondary" data-tx="reject" data-id="${tx.id}">${t('btn.reject')}</button>` : ''}
        ${tx.lunch_id ? '' : `<button class="btn sm secondary" data-tx="delete" data-id="${tx.id}">${t('btn.delete')}</button>`}
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
    if (act === 'delete' && !confirm(t('tx.deleteConfirm'))) return;
    b.disabled = true;
    try {
      if (act === 'delete') await api(`/api/transactions/${b.dataset.id}`, { method: 'DELETE' });
      else await api(`/api/transactions/${b.dataset.id}/${act}`, { method: 'POST' });
      toast(t({ approve: 'toast.approved', reject: 'toast.rejected', delete: 'toast.deleted' }[act]));
      refreshCommon().catch(() => {});
      await loadPayments();
    } catch (err) {
      toastError(err);
      b.disabled = false;
    }
  }));
}

$('#tx-filter').onchange = () => loadPayments().catch(toastError);
$('#add-tx-btn').onclick = () => txModal(null);

// ---------------- Emails ----------------

async function loadEmails() {
  const rows = await api('/api/emails');
  $('#emails-body').innerHTML = rows.length
    ? rows.map((e) => `
      <tr>
        <td>${ltr(esc(e.created_at.slice(0, 16)))}</td><td>${esc(e.member_name || '')}</td><td dir="ltr">${esc(e.to_addr)}</td>
        <td>${esc(e.subject)}</td>
        <td><span class="badge ${e.status}" title="${esc(e.error || '')}">${t('status.' + e.status)}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty-row">${t('emails.empty')}</td></tr>`;
}

// ---------------- Settings ----------------

async function loadSettings() {
  settings = await api('/api/settings');
  const form = $('#settings-form');
  for (const [k, v] of Object.entries(settings)) if (form.elements[k]) form.elements[k].value = v ?? '';
  const s = await api('/api/summary');
  const flag = (on) => `<b>${on ? t('settings.on') : t('settings.off')}</b>`;
  $('#gateway-status').innerHTML =
    esc(t('settings.gateway', { j: '\u0001', m: '\u0002', e: '\u0003' }))
      .replace('\u0001', flag(s.config.jazzcash)).replace('\u0002', flag(s.config.meezan)).replace('\u0003', flag(s.config.email)) +
    `<br>${esc(t('settings.gatewayHelp'))}`;
}

$('#settings-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    settings = await api('/api/settings', { method: 'PUT', body: formData(e.target) });
    $('#brand-name').textContent = settings.company_name || 'Lunch Budget';
    toast(t('toast.settingsSaved'));
  } catch (err) {
    toastError(err);
  }
};

// ---------------- Boot ----------------

renderAuthButton();
api('/api/me').then(start).catch(() => showLogin());
