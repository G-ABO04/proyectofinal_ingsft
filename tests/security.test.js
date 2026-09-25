const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const { fixture }=require('./helpers');
const { hashPassword,verifyPassword,sameSecret }=require('../services/auth-service/src/security');
const { openDatabase,transaction }=require('../services/auth-service/src/database');
const { loadConfig }=require('../services/auth-service/src/config');
const { publicUser }=require('../services/user-service/src/data/usuarios');

test('hash con sal única, verificación y comparación del código de instalación',async()=>{
  const a=await hashPassword('Una contraseña segura'),b=await hashPassword('Una contraseña segura');
  expect(a).not.toBe(b);expect(await verifyPassword('Una contraseña segura',a)).toBe(true);
  expect(await verifyPassword('incorrecta',a)).toBe(false);expect(await verifyPassword('no','')).toBe(false);
  expect(sameSecret('a'.repeat(40),'a'.repeat(40))).toBe(true);expect(sameSecret('a','a')).toBe(false);expect(sameSecret()).toBe(false);
  expect(publicUser(null)).toBeNull();
});

test('configuración rechaza secretos débiles, puertos inválidos y producción sin HTTPS',()=>{
  expect(()=>loadConfig({})).toThrow();expect(()=>loadConfig({JWT_SECRET:'GENERAR_'.repeat(10)})).toThrow();
  const env={JWT_SECRET:'a'.repeat(48)};
  expect(loadConfig(env).host).toBe('127.0.0.1');expect(()=>loadConfig({...env,PORT:'0'})).toThrow();
  expect(()=>loadConfig({...env,PORT:'65536'})).toThrow();expect(()=>loadConfig({...env,NODE_ENV:'production'})).toThrow();
  expect(loadConfig({...env,NODE_ENV:'production',PUBLIC_ORIGIN:'https://example.com',TRUST_PROXY:'1'}).trustProxy).toBe(1);
  expect(loadConfig({...env,HOST:'localhost',SETUP_TOKEN:'token',DATABASE_PATH:'test.sqlite'}).host).toBe('localhost');
});

test('base SQL persiste y una transacción fallida se revierte',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'donativo-db-test-')),file=path.join(folder,'db.sqlite');
  let db=openDatabase(file);
  db.exec('CREATE TABLE example (value TEXT)');
  transaction(db,()=>db.prepare('INSERT INTO example VALUES (?)').run('persistente'));
  expect(()=>transaction(db,()=>{db.prepare('INSERT INTO example VALUES (?)').run('rollback');throw Error('fail');})).toThrow();
  db.close();db=openDatabase(file);
  expect(db.prepare('SELECT * FROM example').all()).toHaveLength(1);db.close();
  fs.rmSync(folder,{recursive:true,force:true});
});

test('cabeceras de seguridad, origen, errores JSON y rutas inexistentes',async()=>{
  const f=await fixture();
  try{
    const response=await f.request.get('/api/health');expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");expect(response.headers['x-powered-by']).toBeUndefined();
    expect((await f.request.get('/api/health').set('Origin',f.config.publicOrigin)).status).toBe(200);
    expect((await f.request.get('/api/health').set('Origin','https://evil.example')).status).toBe(403);
    expect((await f.request.post('/api/auth/login').set('Content-Type','application/json').send('{bad')).status).toBe(400);
    expect((await f.request.post('/api/auth/login').send({text:'a'.repeat(20000)})).status).toBe(413);
    expect((await f.request.get('/api/missing')).status).toBe(404);expect((await f.request.get('/missing')).status).toBe(404);
    expect((await f.request.get('/')).status).toBe(200);expect((await f.request.get('/.env')).status).toBe(404);
  }finally{f.db.close();}
});
