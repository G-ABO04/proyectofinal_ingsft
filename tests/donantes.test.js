const { fixture, donorInput, donationInput } = require('./helpers');
let f;
beforeEach(async () => { f = await fixture(); });
afterEach(() => f.db.close());

test('solo administración accede al directorio y sus mutaciones', async () => {
  for (const method of ['get','post','put','delete']) {
    const path=method==='get'||method==='post'?'/api/donantes':'/api/donantes/ajeno';
    expect((await f.request[method](path).set(f.auth('ana')).send(donorInput())).status).toBe(403);
  }
});

test('alta, consulta, edición y baja conservan el historial', async () => {
  const input=donorInput(f.users.ana.id);
  const created=await f.request.post('/api/donantes').set(f.auth()).send(input);
  expect(created.status).toBe(201);
  const id=created.body.donor.id;
  expect((await f.request.get(`/api/donantes/${id}`).set(f.auth())).body.donor.email).toBe(input.email);
  expect((await f.request.get('/api/donantes').set(f.auth())).body.donors).toHaveLength(1);
  const donation=await f.request.post('/api/donativos').set(f.auth()).send({...donationInput,donorId:id});
  expect(donation.status).toBe(201);
  expect((await f.request.put(`/api/donantes/${id}`).set(f.auth()).send({...input,name:'Nombre nuevo',ownerId:f.users.mateo.id})).status).toBe(200);
  expect((await f.request.get('/api/donativos').set(f.auth('ana'))).body.donations).toHaveLength(0);
  expect((await f.request.get('/api/donativos').set(f.auth('mateo'))).body.donations).toHaveLength(1);
  expect((await f.request.delete(`/api/donantes/${id}`).set(f.auth())).status).toBe(204);
  expect((await f.request.get('/api/donantes').set(f.auth())).body.donors).toHaveLength(0);
  expect((await f.request.get('/api/donativos').set(f.auth())).body.donations).toHaveLength(1);
});

test('donante no encontrado e identificadores de responsable inválidos', async () => {
  expect((await f.request.get('/api/donantes/missing').set(f.auth())).status).toBe(404);
  expect((await f.request.delete('/api/donantes/missing').set(f.auth())).status).toBe(404);
  expect((await f.request.put('/api/donantes/missing').set(f.auth()).send(donorInput())).status).toBe(404);
  expect((await f.request.post('/api/donantes').set(f.auth()).send(donorInput('missing'))).status).toBe(400);
});

test('validación, duplicados y SQL parametrizado', async () => {
  expect((await f.request.post('/api/donantes').set(f.auth()).send({...donorInput(),phone:'1234567890123'})).status).toBe(400);
  const input={...donorInput(),name:"Robert'); DROP TABLE donors;--"};
  expect((await f.request.post('/api/donantes').set(f.auth()).send(input)).status).toBe(201);
  expect((await f.request.post('/api/donantes').set(f.auth()).send(input)).status).toBe(409);
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM donors').get().n).toBe(1);
});

test('perfil vinculado no se transfiere ni elimina; se sincroniza con su cuenta', async () => {
  await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  const row=(await f.request.get('/api/donantes').set(f.auth())).body.donors[0];
  const input={...donorInput(f.users.mateo.id),email:'ana@example.com'};
  expect((await f.request.put(`/api/donantes/${row.id}`).set(f.auth()).send(input)).status).toBe(409);
  expect((await f.request.delete(`/api/donantes/${row.id}`).set(f.auth())).status).toBe(409);
  input.ownerId=f.users.ana.id; input.name='Ana desde administración';
  expect((await f.request.put(`/api/donantes/${row.id}`).set(f.auth()).send(input)).status).toBe(200);
  expect((await f.request.get('/api/auth/me').set(f.auth('ana'))).body.user.name).toBe(input.name);
});
