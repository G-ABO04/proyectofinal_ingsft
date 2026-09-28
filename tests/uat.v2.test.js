const { fixture } = require('./helpers');

let f;
beforeEach(async () => { f = await fixture(); });
afterEach(() => f.db.close());

describe('UAT Versión 2 - Pruebas de Aceptación de Usuario (Flujos E2E)', () => {
  
  test('Escenario UAT 1: Ciclo de vida completo V2 (Ingreso -> Verificación -> Gasto -> Contabilidad -> Fiscal)', async () => {
    // 1. Un nuevo donante (Ana) ingresa a la plataforma y hace un donativo para la campaña de V2.
    const donativoData = { type: 'Efectivo', amount: 50000.00, date: '2026-09-01', notes: 'Donación fuerte UAT' };
    const resDonativo = await f.request.post('/api/donativos').set(f.auth('ana')).send(donativoData);
    expect(resDonativo.status).toBe(201);
    const donationId = resDonativo.body.donation.id;

    // 2. El Administrador entra al sistema y verifica que el dinero entró a la cuenta bancaria.
    const resVerificar = await f.request.patch(`/api/donativos/${donationId}/verificar`).set(f.auth('admin'));
    expect(resVerificar.status).toBe(200);

    // 3. El Administrador emite el recibo fiscal (el donante Ana actualiza sus datos fiscales primero).
    const seqDonation = f.db.prepare("SELECT seq, donor_id FROM donations WHERE status='Verificado' ORDER BY seq DESC LIMIT 1").get();
    f.db.prepare("UPDATE donors SET tax_id='ANA010101XYZ', zip_code='10000', tax_regime='605' WHERE id=?").run(seqDonation.donor_id);
    
    const resFiscal = await f.request.post(`/api/fiscal/emit/${seqDonation.seq}`).set(f.auth('admin'));
    expect(resFiscal.status).toBe(201);
    expect(resFiscal.body.receipt.uuid_fiscal).toBeDefined();

    // 4. Se crea un proyecto operativo en V2
    const resProject = await f.request.post('/api/gastos/projects').set(f.auth('admin')).send({ name: 'Expansión V2', budget_cents: 2000000 });
    const projectId = resProject.body.project.id;

    // 5. Un usuario registra un gasto de expansión, y el admin lo aprueba
    const resGasto = await f.request.post('/api/gastos/expenses').set(f.auth('mateo')).send({
      project_id: projectId, amount_cents: 1500000, category: 'Operativo', description: 'Servidores V2', date: '2026-09-02'
    });
    expect(resGasto.status).toBe(201);
    await f.request.patch(`/api/gastos/expenses/${resGasto.body.expense.seq}/approve`).set(f.auth('admin'));

    // 6. El sistema contable debe reflejar la realidad del balance
    const resBalance = await f.request.get('/api/contabilidad/balance').set(f.auth('admin'));
    expect(resBalance.status).toBe(200);
    // Donativo 50000.00 = 5000000 cents. Gasto 1500000 cents.
    expect(resBalance.body.balance.total_income_cents).toBe(5000000);
    expect(resBalance.body.balance.total_expense_cents).toBe(1500000);
    expect(resBalance.body.balance.available_balance_cents).toBe(3500000);
  });
});
