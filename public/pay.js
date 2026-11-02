const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const token = params.get('m');
let info = null;
let method = 'jazzcash';
let result = null; // { status, message } from a gateway redirect

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n, sign = '') {
  return ltr(`${sign}${info?.currency || 'Rs'} ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`);
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = ''), 3500);
}

async function api(path, body) {
  const res = await fetch(`/api/public/${encodeURIComponent(token)}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function readResult() {
  const status = params.get('status');
  if (!status) return;
  result = { status, message: params.get('message') };
  history.replaceState(null, '', `?m=${encodeURIComponent(token || '')}`);
}

function renderResult() {
  if (!result) return;
  const el = $('#result');
  el.textContent = tMsg(result.message) || (result.status === 'success' ? t('pay.success') : t('pay.failed'));
  el.className = `notice ${result.status === 'success' ? 'ok' : 'err'}`;
}

function renderMethod() {
  document.querySelectorAll('.method-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.method === method));
  const cfg = info[method];
  $('#online-box').classList.toggle('hidden', !cfg.online);
  $('#pay-online').textContent = method === 'jazzcash' ? t('pay.payJazz') : t('pay.payMeezan');

  let details = '';
  if (method === 'jazzcash') {
    if (cfg.number) {
      details = `${t('pay.jazzDetails')}<br><b dir="ltr">${esc(cfg.number)}</b>` +
        (cfg.title ? `<br>${t('pay.titleLabel')}: ${esc(cfg.title)}` : '');
    }
    $('#reference-label').textContent = t('pay.tid');
  } else {
    if (cfg.account_number || cfg.iban) {
      details = `${t('pay.meezanDetails')}<br>` +
        (cfg.account_title ? `${t('pay.titleLabel')}: <b>${esc(cfg.account_title)}</b><br>` : '') +
        (cfg.account_number ? `${t('pay.accountNo')}: <b dir="ltr">${esc(cfg.account_number)}</b><br>` : '') +
        (cfg.iban ? `${t('field.iban')}: <b dir="ltr">${esc(cfg.iban)}</b><br>` : '') +
        (cfg.branch ? `${t('field.branch')}: ${esc(cfg.branch)}` : '');
    }
    $('#reference-label').textContent = t('pay.bankRef');
  }
  $('#account-details').innerHTML = details;
  $('#manual-box').classList.toggle('hidden', !details);
  if (!details && !cfg.online) {
    $('#manual-box').classList.remove('hidden');
    $('#account-details').textContent = t('pay.notSetup');
  }
}

function render() {
  renderResult();
  if (!info) return;
  const m = info.member;
  $('#brand-name').textContent = info.company_name || 'Lunch Budget';
  $('#company').textContent = t('pay.company', { company: info.company_name });
  $('#member-name').textContent = m.name;
  $('#balance').textContent = money(m.balance);
  $('#balance').classList.toggle('neg', m.balance <= 0);
  $('#balance-detail').textContent =
    t('pay.summary', { deposited: money(m.deposited), spent: money(m.spent) }) +
    (m.pending ? t('pay.awaiting', { amount: money(m.pending) }) : '');
  $('#history').innerHTML = info.history.length
    ? info.history.map((tx) => `
      <tr>
        <td>${ltr(esc(tx.created_at.slice(0, 10)))}</td>
        <td>${esc(tMsg(tx.note) || t('method.' + tx.method))}</td>
        <td class="num ${tx.type === 'expense' ? 'neg' : 'pos'}">${money(tx.amount, tx.type === 'expense' ? '−' : '+')}</td>
        <td>${tx.status !== 'approved' ? `<span class="badge ${tx.status}">${t('status.' + tx.status)}</span>` : ''}</td>
      </tr>`).join('')
    : `<tr><td class="empty-row">${t('pay.noHistory')}</td></tr>`;
  $('#content').classList.remove('hidden');
  renderMethod();
}

let loadError = null;
function renderError() {
  if (!loadError) return;
  $('#error').textContent = loadError === 'missing' ? t('pay.missingToken') : tMsg(loadError);
  $('#error').classList.remove('hidden');
}

async function load() {
  if (!token) {
    loadError = 'missing';
    return renderError();
  }
  try {
    info = await api('');
    render();
  } catch (err) {
    loadError = err.message;
    renderError();
  }
}

function amount() {
  const a = Number($('#amount').value);
  if (!a || a <= 0) {
    toast(t('pay.enterAmount'), true);
    $('#amount').focus();
    return null;
  }
  return a;
}

document.querySelectorAll('.method-tab').forEach((tab) => (tab.onclick = () => { method = tab.dataset.method; renderMethod(); }));
document.querySelectorAll('[data-amt]').forEach((b) => (b.onclick = () => ($('#amount').value = b.dataset.amt)));

$('#pay-online').onclick = async () => {
  const a = amount();
  if (!a) return;
  const btn = $('#pay-online');
  btn.disabled = true;
  try {
    const r = await api(`/${method}`, { amount: a });
    if (r.redirect) {
      location.href = r.redirect;
    } else {
      // JazzCash: auto-submit a form to their hosted checkout
      const form = $('#gateway-form');
      form.action = r.action;
      form.innerHTML = Object.entries(r.fields)
        .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
      form.submit();
    }
  } catch (err) {
    toast(tMsg(err.message), true);
    btn.disabled = false;
  }
};

$('#submit-manual').onclick = async () => {
  const a = amount();
  if (!a) return;
  const btn = $('#submit-manual');
  btn.disabled = true;
  try {
    await api('/manual', { method, amount: a, reference: $('#reference').value });
    toast(t('pay.thanks'));
    $('#amount').value = '';
    $('#reference').value = '';
    await load();
  } catch (err) {
    toast(tMsg(err.message), true);
  }
  btn.disabled = false;
};

setupChrome({ onLangChange: () => { render(); renderError(); } });
readResult();
renderResult();
load();
