const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function openDatabase(filename = ':memory:') {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Administrador','Usuario')),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), phone TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL, last_access TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS donors (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, phone TEXT NOT NULL,
      person TEXT NOT NULL CHECK(person IN ('Persona física','Persona moral')),
      date TEXT NOT NULL, owner_id TEXT REFERENCES users(id),
      account_user_id TEXT UNIQUE REFERENCES users(id), deleted_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS donor_email_owner ON donors(email, COALESCE(owner_id,'')) WHERE deleted_at IS NULL;
    CREATE TABLE IF NOT EXISTS donations (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, donor_id TEXT NOT NULL REFERENCES donors(id),
      owner_id TEXT REFERENCES users(id), created_by_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('Efectivo','Especie')),
      amount_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_cents >= 0), description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Registrado' CHECK(status IN ('Registrado','Verificado')),
      verified_by_id TEXT REFERENCES users(id), verified_at TEXT,
      CHECK((type='Efectivo' AND amount_cents>0 AND description='') OR (type='Especie' AND amount_cents=0 AND length(description)>0))
    );
    CREATE INDEX IF NOT EXISTS donation_owner_date ON donations(owner_id,date);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
    PRAGMA user_version = 1;
  `);
  return db;
}

function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

module.exports = { openDatabase, transaction };
