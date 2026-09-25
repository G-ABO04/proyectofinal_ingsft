const { fixture, donationInput } = require('./helpers');
let f;
beforeEach(async () => { f=await fixture(); });
afterEach(() => f.db.close());

test('registra a nombre de la sesión; aísla listas, detalles y serialización', async () => {
  const first=await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  expect(first.status).toBe(201);
  expect(first.body.donation.amount).toBe(500.25);
  expect(first.body.donation.ownerId).toBeUndefined();
  expect(first.body.donation.donorName).toBeUndefined();
  const id=first.body.donation.id;
  expect((await f.request.get(`/api/donativos/${id}`).set(f.auth('mateo'))).status).toBe(404);
  expect((await f.request.get(`/api/donativos/${id}`).set(f.auth('ana'))).status).toBe(200);
  expect((await f.request.get('/api/donativos').set(f.auth('mateo'))).body.donations).toEqual([]);
  const admin=(await f.request.get('/api/donativos').set(f.auth())).body.donations;
  expect(admin).toHaveLength(1);expect(admin[0].ownerId).toBe(f.users.ana.id);
  expect((await f.request.post('/api/donativos').set(f.auth('mateo')).send({...donationInput,donorId:admin[0].donorId})).status).toBe(403);
  expect((await f.request.post('/api/donativos').set(f.auth('mateo')).send({...donationInput,ownerId:f.users.ana.id})).status).toBe(400);
});

test('efectivo y especie reutilizan identidad; perfil actualiza identidad sin duplicarla', async () => {
  await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  const response=await f.request.post('/api/donativos').set(f.auth('ana')).send({type:'Especie',description:'10 cajas',date:'2026-01-02'});
  expect(response.status).toBe(201);expect(response.body.donation.amount).toBe(0);
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM donors').get().n).toBe(1);
  await f.request.put('/api/auth/profile').set(f.auth('ana')).send({name:'Ana Editada',phone:'5512345678'});
  expect(f.db.prepare('SELECT name FROM donors').get().name).toBe('Ana Editada');
});

test('solo el administrador verifica; operación idempotente y autor registrado', async () => {
  const created=await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  const url=`/api/donativos/${created.body.donation.id}/verificar`;
  expect((await f.request.patch(url).set(f.auth('ana'))).status).toBe(403);
  expect((await f.request.patch(url).set(f.auth())).body.donation.status).toBe('Verificado');
  expect((await f.request.patch(url).set(f.auth())).status).toBe(200);
  const row=f.db.prepare('SELECT * FROM donations').get();expect(row.verified_by_id).toBe(f.users.admin.id);
  expect((await f.request.get(`/api/donativos/${created.body.donation.id}`).set(f.auth('ana'))).body.donation.status).toBe('Verificado');
});

test.each([{amount:0},{amount:-1},{amount:1.001},{amount:1000000000},{date:'2099-01-01'},{date:'2026-02-30'},{date:'1999-12-31'},{type:'Especie',description:'   '},{type:'Otro'}])('rechaza datos inválidos %j', async (changes) => {
  expect((await f.request.post('/api/donativos').set(f.auth('ana')).send({...donationInput,...changes})).status).toBe(400);
});

test('requiere donante válido para administración y responde 404 a folios inexistentes', async () => {
  expect((await f.request.post('/api/donativos').set(f.auth()).send(donationInput)).status).toBe(400);
  expect((await f.request.get('/api/donativos/invalid').set(f.auth())).status).toBe(404);
  expect((await f.request.get('/api/donativos/DON-9999').set(f.auth())).status).toBe(404);
  expect((await f.request.patch('/api/donativos/DON-9999/verificar').set(f.auth())).status).toBe(404);
});
