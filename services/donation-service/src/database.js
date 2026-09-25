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
      tax_id TEXT DEFAULT '',
      zip_code TEXT DEFAULT '',
      tax_regime TEXT DEFAULT '',
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
      project_id TEXT REFERENCES projects(id),
      CHECK((type='Efectivo' AND amount_cents>0 AND description='') OR (type='Especie' AND amount_cents=0 AND length(description)>0))
    );
    CREATE INDEX IF NOT EXISTS donation_owner_date ON donations(owner_id,date);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
    
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      budget_cents INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT REFERENCES projects(id),
      created_by_id TEXT NOT NULL REFERENCES users(id),
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      category TEXT NOT NULL CHECK(category IN ('Nómina', 'Operativo', 'Suministros', 'Marketing', 'Otro')),
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Registrado' CHECK(status IN ('Registrado','Pagado')),
      approved_by_id TEXT REFERENCES users(id),
      approved_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS tax_receipts (
      id TEXT PRIMARY KEY,
      donation_seq INTEGER NOT NULL UNIQUE REFERENCES donations(seq),
      donor_id TEXT NOT NULL REFERENCES donors(id),
      tax_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      uuid_fiscal TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Generado' CHECK(status IN ('Generado','Cancelado')),
      created_at TEXT NOT NULL
    );
    

    PRAGMA user_version = 1;

  `);
  try { 
    db.exec("ALTER TABLE donors ADD COLUMN tax_id TEXT DEFAULT '';"); 
    db.exec("ALTER TABLE donors ADD COLUMN zip_code TEXT DEFAULT '';"); 
    db.exec("ALTER TABLE donors ADD COLUMN tax_regime TEXT DEFAULT '';"); 
  } catch (e) {}
  return db;
}

function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

module.exports = { openDatabase, transaction };
