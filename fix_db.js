const fs = require('fs');
const files = [
  'services/auth-service/src/database.js',
  'services/user-service/src/database.js',
  'services/donor-service/src/database.js',
  'services/donation-service/src/database.js',
  'services/expense-service/src/database.js',
  'services/tax-service/src/database.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(`    try { 
      db.exec("ALTER TABLE donors ADD COLUMN tax_id TEXT DEFAULT '';"); 
      db.exec("ALTER TABLE donors ADD COLUMN zip_code TEXT DEFAULT '';"); 
      db.exec("ALTER TABLE donors ADD COLUMN tax_regime TEXT DEFAULT '';"); 
    } catch (e) {}`, '');
  
  if (!content.includes('try { db.exec("ALTER TABLE donors ADD COLUMN tax_id')) {
    content = content.replace('return db;', `try { 
    db.exec("ALTER TABLE donors ADD COLUMN tax_id TEXT DEFAULT '';"); 
    db.exec("ALTER TABLE donors ADD COLUMN zip_code TEXT DEFAULT '';"); 
    db.exec("ALTER TABLE donors ADD COLUMN tax_regime TEXT DEFAULT '';"); 
  } catch (e) {}
  return db;`);
  }
  fs.writeFileSync(file, content);
}
