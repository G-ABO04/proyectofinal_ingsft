const { fixture, donationInput } = require('./helpers');

let f;
beforeEach(async () => { f = await fixture(); });
afterEach(() => f.db.close());

test('emitir y listar comprobantes fiscales simulados', async () => {
  // Crear donativo
  let res = await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  
  // Buscar el seq en la db
  const donationDb = f.db.prepare("SELECT seq, donor_id FROM donations ORDER BY seq DESC LIMIT 1").get();
  const donationSeq = donationDb.seq;
  const publicId = res.body.donation.id;

  // Configurar donante con datos fiscales
  f.db.prepare("UPDATE donors SET tax_id='XAXX010101000', zip_code='12345', tax_regime='601' WHERE id=?").run(donationDb.donor_id);

  // Verificar donativo
  await f.request.patch(`/api/donativos/${publicId}/verificar`).set(f.auth('admin'));
  
  // Non-admin emit
  res = await f.request.post(`/api/fiscal/emit/${donationSeq}`).set(f.auth('ana'));
  expect(res.status).toBe(403);
  
  // Admin emit
  res = await f.request.post(`/api/fiscal/emit/${donationSeq}`).set(f.auth('admin'));
  expect(res.status).toBe(201);
  expect(res.body.receipt.uuid_fiscal).toBeDefined();
  const receiptId = res.body.receipt.id;
  
  // Emit already emitted
  res = await f.request.post(`/api/fiscal/emit/${donationSeq}`).set(f.auth('admin'));
  expect(res.status).toBe(400);
  
  // List receipts
  res = await f.request.get('/api/fiscal/receipts').set(f.auth('admin'));
  expect(res.status).toBe(200);
  expect(res.body.receipts.length).toBe(1);
  
  // Cancel receipt
  res = await f.request.patch(`/api/fiscal/cancel/${receiptId}`).set(f.auth('admin'));
  expect(res.status).toBe(200);
  
  // Cancel already cancelled
  res = await f.request.patch(`/api/fiscal/cancel/${receiptId}`).set(f.auth('admin'));
  expect(res.status).toBe(400);
});

test('errores al emitir comprobantes con datos incompletos o donativos no válidos', async () => {
  let res = await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  const donationDb = f.db.prepare("SELECT seq FROM donations ORDER BY seq DESC LIMIT 1").get();
  const donationSeq = donationDb.seq;
  const publicId = res.body.donation.id;

  res = await f.request.post(`/api/fiscal/emit/${donationSeq}`).set(f.auth('admin'));
  expect(res.status).toBe(400); 

  await f.request.patch(`/api/donativos/${publicId}/verificar`).set(f.auth('admin'));*
  
  res = await f.request.post(`/api/fiscal/emit/${donationSeq}`).set(f.auth('admin'));
  expect(res.status).toBe(400); 
});
