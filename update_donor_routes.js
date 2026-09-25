const fs = require('fs');
const file = 'services/donor-service/src/routes/donantes.routes.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'INSERT INTO donors (id,name,email,phone,person,date,owner_id) VALUES (?,?,?,?,?,?,?)',
  'INSERT INTO donors (id,name,email,phone,person,date,owner_id,tax_id,zip_code,tax_regime) VALUES (?,?,?,?,?,?,?,?,?,?)'
);

content = content.replace(
  'id, input.name, input.email, input.phone, input.person, input.date, input.ownerId',
  "id, input.name, input.email, input.phone, input.person, input.date, input.ownerId, input.taxId || '', input.zipCode || '', input.taxRegime || ''"
);

content = content.replace(
  'UPDATE donors SET name=?,email=?,phone=?,person=?,owner_id=? WHERE id=?',
  'UPDATE donors SET name=?,email=?,phone=?,person=?,owner_id=?,tax_id=?,zip_code=?,tax_regime=? WHERE id=?'
);

content = content.replace(
  'input.name, input.email, input.phone, input.person, ownerId, row.id',
  "input.name, input.email, input.phone, input.person, ownerId, input.taxId || '', input.zipCode || '', input.taxRegime || '', row.id"
);

fs.writeFileSync(file, content);
