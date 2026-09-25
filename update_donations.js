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
  if (!content.includes('project_id TEXT REFERENCES projects(id)')) {
    // Add project_id to CREATE TABLE donations
    content = content.replace(
      "verified_by_id TEXT REFERENCES users(id), verified_at TEXT,",
      "verified_by_id TEXT REFERENCES users(id), verified_at TEXT,\n      project_id TEXT REFERENCES projects(id),"
    );
    // Add ALTER TABLE to handle existing database migrations gracefully
    if (!content.includes("ALTER TABLE donations ADD COLUMN project_id")) {
      const pragmaIndex = content.indexOf('PRAGMA user_version = 1;');
      if (pragmaIndex !== -1) {
        const migration = `
    try { db.exec('ALTER TABLE donations ADD COLUMN project_id TEXT REFERENCES projects(id);'); } catch (e) {}
    PRAGMA user_version = 1;`;
        content = content.replace('PRAGMA user_version = 1;', migration);
      }
    }
    fs.writeFileSync(file, content);
  }
}
