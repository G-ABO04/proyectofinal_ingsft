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
  if (!content.includes('CREATE TABLE IF NOT EXISTS projects')) {
    const newTables = `
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
    PRAGMA user_version = 1;
`;
    content = content.replace('PRAGMA user_version = 1;', newTables);
    fs.writeFileSync(file, content);
  }
}
