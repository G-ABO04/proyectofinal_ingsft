const fs = require('fs');
const files = [
  'services/auth-service/src/database.js',
  'services/user-service/src/database.js',
  'services/donor-service/src/database.js',
  'services/donation-service/src/database.js',
  'services/expense-service/src/database.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('tax_id TEXT')) {
    // Add fiscal fields to donors table
    content = content.replace(
      "person TEXT NOT NULL CHECK(person IN ('Persona física','Persona moral')),",
      "person TEXT NOT NULL CHECK(person IN ('Persona física','Persona moral')),\n      tax_id TEXT DEFAULT '',\n      zip_code TEXT DEFAULT '',\n      tax_regime TEXT DEFAULT '',"
    );
    
    // Add tax_receipts table before PRAGMA user_version
    const newTable = `
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
    PRAGMA user_version = 1;`;
    content = content.replace('PRAGMA user_version = 1;', newTable);
    
    // Add ALTER TABLE for existing sqlite database
    const migration = `
    try { 
      db.exec("ALTER TABLE donors ADD COLUMN tax_id TEXT DEFAULT '';"); 
      db.exec("ALTER TABLE donors ADD COLUMN zip_code TEXT DEFAULT '';"); 
      db.exec("ALTER TABLE donors ADD COLUMN tax_regime TEXT DEFAULT '';"); 
    } catch (e) {}
    PRAGMA user_version = 1;`;
    content = content.replace('PRAGMA user_version = 1;', migration);
    
    fs.writeFileSync(file, content);
  }
}
