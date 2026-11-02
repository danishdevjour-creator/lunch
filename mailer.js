const nodemailer = require('nodemailer');
const { q, getSettings, getMember } = require('./db');

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const logEmail = (...params) =>
  q('INSERT INTO emails (member_id, to_addr, subject, kind, status, error) VALUES ($1, $2, $3, $4, $5, $6)', params);

function money(settings, n) {
  return `${settings.currency} ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function payLink(member) {
  return `${(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/pay.html?m=${member.token}`;
}

function layout(settings, title, bodyHtml, member) {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937">
    <h2 style="margin:0 0 4px">${title}</h2>
    <p style="margin:0 0 16px;color:#6b7280">${settings.company_name} · Lunch Budget</p>
    ${bodyHtml}
    <p style="margin:24px 0">
      <a href="${payLink(member)}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
        Add money (JazzCash / Meezan Bank)
      </a>
    </p>
    <p style="font-size:12px;color:#9ca3af">This is an automated message from the lunch budget system.</p>
  </div>`;
}

const TEMPLATES = {
  empty: (s, m) => ({
    subject: `Your lunch balance has run out (${money(s, m.balance)})`,
    html: layout(s, 'Your lunch balance has run out', `
      <p>Hi ${m.name},</p>
      <p>Your lunch balance is now <b style="color:#b91c1c">${money(s, m.balance)}</b>.
      Please add money so your lunch can continue.</p>
      <p>Total deposited: ${money(s, m.deposited)}<br>Total spent: ${money(s, m.spent)}</p>`, m),
  }),
  low: (s, m) => ({
    subject: `Low lunch balance: ${money(s, m.balance)} left`,
    html: layout(s, 'Your lunch balance is low', `
      <p>Hi ${m.name},</p>
      <p>You have <b style="color:#b45309">${money(s, m.balance)}</b> left in your lunch budget.
      Please top up soon.</p>`, m),
  }),
  received: (s, m, tx) => ({
    subject: `Payment received: ${money(s, tx.amount)}`,
    html: layout(s, 'Payment received', `
      <p>Hi ${m.name},</p>
      <p>We received <b>${money(s, tx.amount)}</b> via ${tx.method}. Thank you!</p>
      <p>Your new balance: <b>${money(s, m.balance)}</b></p>`, m),
  }),
  statement: (s, m) => ({
    subject: `Lunch balance: ${money(s, m.balance)}`,
    html: layout(s, 'Your lunch balance', `
      <p>Hi ${m.name},</p>
      <p>Total deposited: ${money(s, m.deposited)}<br>
      Total spent: ${money(s, m.spent)}<br>
      <b>Remaining: ${money(s, m.balance)}</b></p>`, m),
  }),
};

async function sendMemberEmail(kind, member, tx) {
  const settings = await getSettings();
  const { subject, html } = TEMPLATES[kind](settings, member, tx);
  if (!transporter) {
    console.log(`[email not configured] would send "${subject}" to ${member.email}`);
    await logEmail(member.id, member.email, subject, kind, 'logged', 'SMTP not configured');
    return { status: 'logged' };
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: member.email, subject, html });
    await logEmail(member.id, member.email, subject, kind, 'sent', null);
    return { status: 'sent' };
  } catch (err) {
    console.error('Email failed:', err.message);
    await logEmail(member.id, member.email, subject, kind, 'failed', err.message);
    return { status: 'failed', error: err.message };
  }
}

const setAlertState = (state, id) => q('UPDATE members SET alert_state = $1 WHERE id = $2', [state, id]);

// Call after anything that changes a member's balance. Sends at most one
// "low" and one "empty" email until the member tops up above the threshold.
async function checkBalanceAlert(memberId) {
  const member = await getMember(memberId);
  if (!member || !member.active) return;
  const threshold = Number((await getSettings()).low_balance_threshold || 0);

  if (member.balance <= 0) {
    if (member.alert_state !== 'empty') {
      await setAlertState('empty', member.id);
      await sendMemberEmail('empty', member);
    }
  } else if (member.balance <= threshold) {
    if (!member.alert_state) {
      await setAlertState('low', member.id);
      await sendMemberEmail('low', member);
    }
  } else if (member.alert_state) {
    await setAlertState(null, member.id);
  }
}

module.exports = { sendMemberEmail, checkBalanceAlert, emailConfigured: configured };
