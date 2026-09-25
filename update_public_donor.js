const fs = require('fs');
const file = 'services/donor-service/src/routes/donantes.routes.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const result = { id: row.id, name: row.name, email: row.email, phone: row.phone, person: row.person, date: row.date };',
  'const result = { id: row.id, name: row.name, email: row.email, phone: row.phone, person: row.person, date: row.date, taxId: row.tax_id, zipCode: row.zip_code, taxRegime: row.tax_regime };'
);

fs.writeFileSync(file, content);
