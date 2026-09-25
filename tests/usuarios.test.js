const { fixture, password, donationInput } = require('./helpers');
let f;
beforeEach(async () => { f=await fixture(); });
afterEach(() => f.db.close());
const input={name:'Persona nueva',email:'nueva@example.com',password,role:'Usuario'};

test('solo administración da acceso; nunca expone hashes ni contraseñas', async () => {
  expect((await f.request.get('/api/usuarios').set(f.auth('ana'))).status).toBe(403);
  expect((await f.request.post('/api/usuarios').set(f.auth('ana')).send(input)).status).toBe(403);
  const created=await f.request.post('/api/usuarios').set(f.auth()).send(input);
  expect(created.status).toBe(201);
  expect(JSON.stringify((await f.request.get('/api/usuarios').set(f.auth())).body)).not.toMatch(/password|scrypt/);
  expect((await f.request.post('/api/auth/login').send({email:input.email,password})).status).toBe(200);
  expect((await f.request.post('/api/usuarios').set(f.auth()).send(input)).status).toBe(409);
});

test('cambio de rol y contraseña revocan sesiones existentes', async () => {
  const auth=f.auth('ana'), path=`/api/usuarios/${f.users.ana.id}`;
  expect((await f.request.put(path).set(f.auth()).send({name:'Ana',email:'ana@example.com',role:'Administrador'})).status).toBe(200);
  expect((await f.request.get('/api/auth/me').set(auth)).status).toBe(401);
  const next=f.auth('ana');
  await f.request.put(path).set(f.auth()).send({name:'Ana',email:'ana@example.com',role:'Administrador',password:'Una contraseña completamente nueva'});
  expect((await f.request.get('/api/auth/me').set(next)).status).toBe(401);
});

test('autoprotección del administrador, activación, desactivación y usuarios inexistentes', async () => {
  const self=`/api/usuarios/${f.users.admin.id}`;
  expect((await f.request.put(self).set(f.auth()).send({name:'Admin',email:'admin@example.com',role:'Usuario'})).status).toBe(409);
  expect((await f.request.patch(`${self}/estado`).set(f.auth()).send({active:false})).status).toBe(409);
  const path=`/api/usuarios/${f.users.ana.id}/estado`,old=f.auth('ana');
  expect((await f.request.patch(path).set(f.auth()).send({active:false})).body.user.active).toBe(false);
  expect((await f.request.get('/api/auth/me').set(old)).status).toBe(401);
  expect((await f.request.patch(path).set(f.auth()).send({active:true})).body.user.active).toBe(true);
  expect((await f.request.put('/api/usuarios/missing').set(f.auth()).send({name:'Admin',email:'otro@example.com',role:'Usuario'})).status).toBe(404);
  expect((await f.request.patch('/api/usuarios/missing/estado').set(f.auth()).send({active:false})).status).toBe(404);
});

test('edición sincroniza el perfil de donador y rechaza contraseña débil', async () => {
  await f.request.post('/api/donativos').set(f.auth('ana')).send(donationInput);
  expect((await f.request.put(`/api/usuarios/${f.users.ana.id}`).set(f.auth()).send({name:'Ana Nueva',email:'ana.nueva@example.com',role:'Usuario'})).status).toBe(200);
  expect(f.db.prepare('SELECT email FROM donors').get().email).toBe('ana.nueva@example.com');
  expect((await f.request.post('/api/usuarios').set(f.auth()).send({...input,password:'123456'})).status).toBe(400);
});
