const crypto = require('crypto');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Create a Postgres database (e.g. Neon) and add its connection string.');
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
});

// Timestamps are stored as Pakistan-time text so the UI can slice them directly.
const NOW = `to_char(now() AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI:SS')`;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS members (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    department  TEXT,
    token       TEXT NOT NULL UNIQUE,
    active      INTEGER NOT NULL DEFAULT 1,
    alert_state TEXT,                       -- NULL | 'low' | 'empty'
    created_at  TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE IF NOT EXISTS lunches (
    id          SERIAL PRIMARY KEY,
    date        TEXT NOT NULL,
    description TEXT,
    total       DOUBLE PRECISION NOT NULL,
    per_person  DOUBLE PRECISION NOT NULL,
    headcount   INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          SERIAL PRIMARY KEY,
    member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('deposit','expense')),
    amount      DOUBLE PRECISION NOT NULL CHECK (amount > 0),
    method      TEXT,                        -- cash | jazzcash | meezan | lunch | adjustment
    reference   TEXT,                        -- TID / bank reference entered by member
    gateway_ref TEXT UNIQUE,                 -- our order id sent to JazzCash / Meezan
    status      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
    note        TEXT,
    lunch_id    INTEGER REFERENCES lunches(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX IF NOT EXISTS idx_tx_member ON transactions(member_id);
  CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS emails (
    id         SERIAL PRIMARY KEY,
    member_id  INTEGER REFERENCES members(id) ON DELETE SET NULL,
    to_addr    TEXT NOT NULL,
    subject    TEXT NOT NULL,
    kind       TEXT,
    status     TEXT NOT NULL,                -- sent | failed | logged
    error      TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
`;

const DEFAULT_SETTINGS = {
  company_name: 'My Company',
  currency: 'Rs',
  low_balance_threshold: '500',
  default_lunch_cost: '300',
  jazzcash_number: '',
  jazzcash_title: '',
  meezan_account_title: '',
  meezan_account_number: '',
  meezan_iban: '',
  meezan_branch: '',
};

// Runs once per cold start; every query waits for it.
let ready = null;
function init() {
  if (!ready) {
    ready = (async () => {
      await pool.query(SCHEMA);
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
        await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [k, v]);
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

async function q(sql, params = [], client = pool) {
  await init();
  return (await client.query(sql, params)).rows;
}

async function one(sql, params = [], client = pool) {
  return (await q(sql, params, client))[0];
}

// Runs fn(client) inside BEGIN/COMMIT on a single connection.
async function transaction(fn) {
  await init();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getSettings() {
  const out = {};
  for (const row of await q('SELECT key, value FROM settings')) out[row.key] = row.value;
  return out;
}

async function saveSettings(values) {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in values) {
      await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        [key, String(values[key] ?? '').trim()]);
    }
  }
}

const BALANCE_SQL = `
  SELECT m.*,
    COALESCE(SUM(CASE WHEN t.type='deposit' AND t.status='approved' THEN t.amount END), 0) AS deposited,
    COALESCE(SUM(CASE WHEN t.type='expense' AND t.status='approved' THEN t.amount END), 0) AS spent,
    COALESCE(SUM(CASE WHEN t.type='deposit' AND t.status='pending'  THEN t.amount END), 0) AS pending
  FROM members m
  LEFT JOIN transactions t ON t.member_id = m.id
`;

function withBalance(row) {
  if (!row) return row;
  row.balance = Math.round((row.deposited - row.spent) * 100) / 100;
  return row;
}

async function listMembers({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE m.active = 1';
  return (await q(`${BALANCE_SQL} ${where} GROUP BY m.id ORDER BY lower(m.name)`)).map(withBalance);
}

async function getMember(id) {
  if (!Number.isInteger(Number(id))) return undefined;
  return withBalance(await one(`${BALANCE_SQL} WHERE m.id = $1 GROUP BY m.id`, [Number(id)]));
}

async function getMemberByToken(token) {
  return withBalance(await one(`${BALANCE_SQL} WHERE m.token = $1 AND m.active = 1 GROUP BY m.id`, [String(token)]));
}

function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

module.exports = { q, one, transaction, getSettings, saveSettings, listMembers, getMember, getMemberByToken, newToken, round2 };
