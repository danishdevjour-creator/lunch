const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'data', 'lunch.db'));

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    department  TEXT,
    token       TEXT NOT NULL UNIQUE,
    active      INTEGER NOT NULL DEFAULT 1,
    alert_state TEXT,                       -- NULL | 'low' | 'empty'
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS lunches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    description TEXT,
    total       REAL NOT NULL,
    per_person  REAL NOT NULL,
    headcount   INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('deposit','expense')),
    amount      REAL NOT NULL CHECK (amount > 0),
    method      TEXT,                        -- cash | jazzcash | meezan | lunch | adjustment
    reference   TEXT,                        -- TID / bank reference entered by member
    gateway_ref TEXT UNIQUE,                 -- our order id sent to JazzCash / Meezan
    status      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
    note        TEXT,
    lunch_id    INTEGER REFERENCES lunches(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_tx_member ON transactions(member_id);
  CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS emails (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id  INTEGER REFERENCES members(id) ON DELETE SET NULL,
    to_addr    TEXT NOT NULL,
    subject    TEXT NOT NULL,
    kind       TEXT,
    status     TEXT NOT NULL,                -- sent | failed | logged
    error      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

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

const insertDefault = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertDefault.run(k, v);

function getSettings() {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  return out;
}

function saveSettings(values) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in values) stmt.run(key, String(values[key] ?? '').trim());
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

function listMembers({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE m.active = 1';
  return db.prepare(`${BALANCE_SQL} ${where} GROUP BY m.id ORDER BY m.name COLLATE NOCASE`).all().map(withBalance);
}

function getMember(id) {
  return withBalance(db.prepare(`${BALANCE_SQL} WHERE m.id = ? GROUP BY m.id`).get(id));
}

function getMemberByToken(token) {
  return withBalance(db.prepare(`${BALANCE_SQL} WHERE m.token = ? AND m.active = 1 GROUP BY m.id`).get(token));
}

function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

module.exports = { db, getSettings, saveSettings, listMembers, getMember, getMemberByToken, newToken, round2 };
