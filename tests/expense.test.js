const { fixture } = require('./helpers');

let f;
beforeEach(async () => { f = await fixture(); });
afterEach(() => f.db.close());

test('crear y listar proyectos (solo admin)', async () => {
  let res = await f.request.post('/api/gastos/projects').set(f.auth('admin')).send({ name: 'Proyecto A', budget_cents: 100000 });
  expect(res.status).toBe(201);
  expect(res.body.project.name).toBe('Proyecto A');
  
  res = await f.request.post('/api/gastos/projects').set(f.auth('ana')).send({ name: 'Proyecto B', budget_cents: 50000 });
  expect(res.status).toBe(403);
  
  res = await f.request.post('/api/gastos/projects').set(f.auth('admin')).send({ name: 'Proyecto A', budget_cents: 100000 });
  expect(res.status).toBe(409);

  res = await f.request.get('/api/gastos/projects').set(f.auth('ana'));
  expect(res.status).toBe(200);
  expect(res.body.projects.length).toBe(1);
});

test('crear, listar y aprobar egresos', async () => {
  const expenseData = { amount_cents: 5000, category: 'Suministros', description: 'Papelería', date: '2026-02-01' };
  
  let res = await f.request.post('/api/gastos/expenses').set(f.auth('ana')).send(expenseData);
  expect(res.status).toBe(201);
  const seq = res.body.expense.seq;
  
  res = await f.request.get('/api/gastos/expenses').set(f.auth('ana'));
  expect(res.status).toBe(200);
  expect(res.body.expenses.length).toBe(1);
  expect(res.body.expenses[0].status).toBe('Registrado');
  
  res = await f.request.patch(`/api/gastos/expenses/${seq}/approve`).set(f.auth('ana'));
  expect(res.status).toBe(403);
  
  res = await f.request.patch(`/api/gastos/expenses/${seq}/approve`).set(f.auth('admin'));
  expect(res.status).toBe(200);
  
  res = await f.request.patch(`/api/gastos/expenses/${seq}/approve`).set(f.auth('admin'));
  expect(res.status).toBe(400);
  
  res = await f.request.post('/api/gastos/expenses').set(f.auth('ana')).send({});
  expect(res.status).toBe(400);
});
