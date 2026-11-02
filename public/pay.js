const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);
const token = params.get('m');
let info = null;
let method = 'jazzcash';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(n) {
  return `${info?.currency || 'Rs'} ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
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

function showResult() {
  const status = params.get('status');
  if (!status) return;
  const el = $('#result');
  el.textContent = params.get('message') || (status === 'success' ? 'Payment successful' : 'Payment failed');
  el.className = `notice ${status === 'success' ? 'ok' : 'err'}`;
  history.replaceState(null, '', `?m=${token}`);
}

function renderMethod() {
  document.querySelectorAll('.method-tab').forEach((t) => t.classList.toggle('active', t.dataset.method === method));
  const cfg = info[method];
  $('#online-box').classList.toggle('hidden', !cfg.online);
  $('#pay-online').textContent = method === 'jazzcash' ? 'Pay with JazzCash' : 'Pay with Meezan Bank';

  let details = '';
  if (method === 'jazzcash') {
    details = cfg.number
      ? `Send money to this JazzCash account:<br><b>${esc(cfg.number)}</b>${cfg.title ? `<br>Title: ${esc(cfg.title)}` : ''}`
      : '';
    $('#reference-label').textContent = 'JazzCash Transaction ID (TID)';
  } else {
    details = cfg.account_number || cfg.iban
      ? `Transfer to this Meezan Bank account:<br>
         ${cfg.account_title ? `Title: <b>${esc(cfg.account_title)}</b><br>` : ''}
         ${cfg.account_number ? `Account #: <b>${esc(cfg.account_number)}</b><br>` : ''}
         ${cfg.iban ? `IBAN: <b>${esc(cfg.iban)}</b><br>` : ''}
         ${cfg.branch ? `Branch: ${esc(cfg.branch)}` : ''}`
      : '';
    $('#reference-label').textContent = 'Bank transaction reference / ID';
  }
  $('#account-details').innerHTML = details;
  $('#manual-box').classList.toggle('hidden', !details);
  if (!details && !cfg.online) {
    $('#manual-box').classList.remove('hidden');
    $('#account-details').innerHTML = 'Account details have not been set up yet. Please contact the admin.';
  }
}

async function load() {
  if (!token) throw new Error('This payment link is missing the member code. Ask your admin for your personal link.');
  info = await api('');
  const m = info.member;
  $('#company').textContent = `${info.company_name} · Lunch budget`;
  $('#member-name').textContent = m.name;
  $('#balance').textContent = money(m.balance);
  $('#balance').style.color = m.balance <= 0 ? 'var(--danger)' : 'var(--ok)';
  $('#balance-detail').textContent =
    `Deposited ${money(m.deposited)} · Spent ${money(m.spent)}` + (m.pending ? ` · ${money(m.pending)} awaiting confirmation` : '');
  $('#history').innerHTML = info.history.length
    ? info.history.map((t) => `
      <tr>
        <td>${esc(t.created_at.slice(0, 10))}</td>
        <td>${esc(t.note || t.method)}</td>
        <td class="num ${t.type === 'expense' ? 'neg' : 'pos'}">${t.type === 'expense' ? '−' : '+'}${money(t.amount)}</td>
        <td>${t.status !== 'approved' ? `<span class="badge ${t.status}">${t.status}</span>` : ''}</td>
      </tr>`).join('')
    : '<tr><td class="empty-row">No history yet</td></tr>';
  $('#content').classList.remove('hidden');
  renderMethod();
}

function amount() {
  const a = Number($('#amount').value);
  if (!a || a <= 0) {
    toast('Please enter an amount', true);
    $('#amount').focus();
    return null;
  }
  return a;
}

document.querySelectorAll('.method-tab').forEach((t) => (t.onclick = () => { method = t.dataset.method; renderMethod(); }));
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
    toast(err.message, true);
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
    toast('Thanks! Your payment is waiting for admin confirmation.');
    $('#amount').value = '';
    $('#reference').value = '';
    await load();
  } catch (err) {
    toast(err.message, true);
  }
  btn.disabled = false;
};

showResult();
load().catch((err) => {
  $('#error').textContent = err.message;
  $('#error').classList.remove('hidden');
});
