const { randomUUID } = require('node:crypto');
const { today } = require('../validation');

function publicDonor(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, person: row.person, date: row.date, ownerId: row.owner_id, accountUserId: row.account_user_id };
}

function personalDonor(db, user) {
  let row = db.prepare('SELECT * FROM donors WHERE account_user_id=?').get(user.id);
  if (!row) {
    const id = randomUUID();
    db.prepare('INSERT INTO donors (id,name,email,phone,person,date,owner_id,account_user_id) VALUES (?,?,?,?,?,?,?,?)').run(id, user.name, user.email, user.phone, 'Persona física', today(), user.id, user.id);
    row = db.prepare('SELECT * FROM donors WHERE id=?').get(id);
  }
  return row;
}

module.exports = { publicDonor, personalDonor };
