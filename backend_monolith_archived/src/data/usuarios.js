const { randomUUID } = require('node:crypto');
const { today } = require('../validation');

function publicUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role, active: Boolean(row.active), phone: row.phone, joinedAt: row.joined_at, lastAccess: row.last_access };
}

function createUser(db, input, passwordHash) {
  const id = randomUUID();
  db.prepare('INSERT INTO users (id,name,email,password_hash,role,joined_at) VALUES (?,?,?,?,?,?)').run(id, input.name, input.email, passwordHash, input.role, today());
  return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id));
}

module.exports = { publicUser, createUser };
