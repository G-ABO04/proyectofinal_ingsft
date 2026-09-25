const { fixture, password } = require('./helpers');
let f;
afterEach(() => f?.db.close());

test('primera instalación protegida y administrador único', async () => {
  f = await fixture(true);
  expect((await f.request.get('/api/auth/status')).body.setupRequired).toBe(true);
  const input = { name:'Administrador', email:'admin@example.com', password, setupToken:'incorrecto' };
  expect((await f.request.post('/api/auth/setup').send(input)).status).toBe(403);
  input.setupToken = f.config.setupToken;
  const response = await f.request.post('/api/auth/setup').send(input);
  expect(response.status).toBe(201);
  expect(response.body.user.role).toBe('Administrador');
  expect(response.body.user.password_hash).toBeUndefined();
  expect((await f.request.post('/api/auth/setup').send(input)).status).toBe(409);
  expect((await f.request.get('/api/auth/status')).body.setupRequired).toBe(false);
});

test('login, sesión y revocación al cerrar sesión', async () => {
  f = await fixture();
  const response = await f.request.post('/api/auth/login').send({ email:'ana@example.com', password });
  expect(response.status).toBe(200);
  expect(response.body.accessToken.split('.')).toHaveLength(3);
  const auth = { Authorization:`Bearer ${response.body.accessToken}` };
  expect((await f.request.get('/api/auth/me').set(auth)).body.user.id).toBe(f.users.ana.id);
  expect((await f.request.post('/api/auth/logout').set(auth)).status).toBe(204);
  expect((await f.request.get('/api/auth/me').set(auth)).status).toBe(401);
});

test.each(['inexistente@example.com', 'ana@example.com'] )('rechaza credenciales incorrectas sin enumeración: %s', async (email) => {
  f = await fixture();
  const response = await f.request.post('/api/auth/login').send({ email,password:'incorrecta' });
  expect(response.status).toBe(401);
  expect(response.body.error).toMatch(/No se pudo iniciar/);
});

test('rechaza cuenta inactiva y revoca acceso existente', async () => {
  f = await fixture();
  const auth = f.auth('ana');
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(f.users.ana.id);
  expect((await f.request.post('/api/auth/login').send({ email:'ana@example.com', password })).status).toBe(401);
  expect((await f.request.get('/api/auth/me').set(auth)).status).toBe(401);
});

test('rechaza JWT ausente, manipulado, vencido, audiencia incorrecta y sesión ajena', async () => {
  f = await fixture();
  expect((await f.request.get('/api/auth/me')).status).toBe(401);
  expect((await f.request.get('/api/auth/me').set('Authorization','Bearer falso')).status).toBe(401);
  for (const claims of [{ expiresIn:-1 },{ audience:'otra-app' },{ issuer:'otra-app' }]) {
    expect((await f.request.get('/api/auth/me').set('Authorization',`Bearer ${f.token(f.users.ana,claims)}`)).status).toBe(401);
  }
  const token=f.token(f.users.ana,{ subject:f.users.mateo.id });
  expect((await f.request.get('/api/auth/me').set('Authorization',`Bearer ${token}`)).status).toBe(401);
});

test('validación y límite real de intentos de login', async () => {
  f = await fixture(false,{ loginMax:2 });
  expect((await f.request.post('/api/auth/login').send({email:'no',password:'x'})).status).toBe(400);
  await f.request.post('/api/auth/login').send({email:'ana@example.com',password:'x'});
  expect((await f.request.post('/api/auth/login').send({email:'ana@example.com',password})).status).toBe(429);
});

test('perfil solo permite nombre/teléfono, nunca rol ni identidad ajena', async () => {
  f = await fixture();
  const auth=f.auth('ana');
  expect((await f.request.put('/api/auth/profile').set(auth).send({name:'Ana Actualizada',phone:'5512345678',role:'Administrador'})).status).toBe(400);
  const response=await f.request.put('/api/auth/profile').set(auth).send({name:'Ana Actualizada',phone:'5512345678'});
  expect(response.body.user.name).toBe('Ana Actualizada');
  expect(response.body.user.role).toBe('Usuario');
  expect(f.db.prepare('SELECT name FROM users WHERE id=?').get(f.users.mateo.id).name).toBe('mateo');
});
