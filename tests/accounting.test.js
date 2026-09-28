const { fixture, donationInput } = require('./helpers');

let f;
beforeEach(async () => { f = await fixture(); });
afterEach(() => f.db.close());

test('balance general simplificado y estado de resultados (solo admin)', async () => {
  // Crear un donativo y verificarlo
  let res = await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  const publicId = res.body.donation.id;
  await f.request.patch(`/api/donativos/${publicId}/verificar`).set(f.auth('admin')); // Ingreso: 50025 cents (500.25)
  
  // Crear un gasto y aprobarlo
  res = await f.request.post('/api/gastos/expenses').set(f.auth('ana')).send({
    amount_cents: 10000, category: 'Suministros', description: 'Papelería', date: '2026-02-01'
  }); // Gasto: 10000 cents (100.00)
  const expenseSeq = res.body.expense.seq;
  await f.request.patch(`/api/gastos/expenses/${expenseSeq}/approve`).set(f.auth('admin'));

  // Balance general
  res = await f.request.get('/api/contabilidad/balance').set(f.auth('ana'));
  expect(res.status).toBe(403);
  
  res = await f.request.get('/api/contabilidad/balance').set(f.auth('admin'));
  expect(res.status).toBe(200);
  expect(res.body.balance.total_income_cents).toBe(50025);
  expect(res.body.balance.total_expense_cents).toBe(10000);
  expect(res.body.balance.available_balance_cents).toBe(40025);

  // Estado de resultados
  res = await f.request.get('/api/contabilidad/income-statement').set(f.auth('admin'));
  expect(res.status).toBe(200);
  expect(res.body.income_statement.incomes.length).toBe(1);
  expect(res.body.income_statement.expenses.length).toBe(1);
});

test('resumen financiero por proyectos (fondos restringidos)', async () => {
  // Crear proyecto
  let res = await f.request.post('/api/gastos/projects').set(f.auth('admin')).send({ name: 'Proyecto A', budget_cents: 100000 });
  const projectId = res.body.project.id;

  // Donativo a proyecto
  res = await f.request.post('/api/donativos').set(f.auth('ana')).send({ ...donationInput, projectId });
  await f.request.patch(`/api/donativos/${res.body.donation.id}/verificar`).set(f.auth('admin'));
  
  // Gasto a proyecto
  res = await f.request.post('/api/gastos/expenses').set(f.auth('ana')).send({
    project_id: projectId, amount_cents: 20000, category: 'Operativo', description: 'Silla', date: '2026-02-01'
  });
  await f.request.patch(`/api/gastos/expenses/${res.body.expense.seq}/approve`).set(f.auth('admin'));

  // Donativo general (sin proyecto)
  res = await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  await f.request.patch(`/api/donativos/${res.body.donation.id}/verificar`).set(f.auth('admin'));

  res = await f.request.get('/api/contabilidad/projects-summary').set(f.auth('admin'));
  expect(res.status).toBe(200);
  
  const pA = res.body.projects.find(p => p.id === projectId);
  expect(pA.income_cents).toBe(50025);
  expect(pA.expense_cents).toBe(20000);
  expect(pA.balance_cents).toBe(30025);

  const general = res.body.projects.find(p => p.id === 'general-fund');
  expect(general.income_cents).toBe(50025);
  expect(general.expense_cents).toBe(0);
});
