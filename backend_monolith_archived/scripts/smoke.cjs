// Solo contra una instalación vacía de pruebas. No usar con datos reales.
const assert = require('node:assert/strict');
(async () => {
  const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:3000';
  const password = 'Prueba aislada ' + require('node:crypto').randomBytes(16).toString('hex');
  async function api(route, method='GET', body, token) {
    const response = await fetch(origin+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},body:body ? JSON.stringify(body) : undefined});
    return {status:response.status,body:response.status===204 ? {} : await response.json()};
  }
  assert.equal((await api('/auth/status')).body.setupRequired,true,'La base de pruebas debe estar vacía.');
  assert.equal((await api('/auth/setup','POST',{name:'Admin CI',email:'admin@ci.example',password,setupToken:process.env.SETUP_TOKEN})).status,201);
  const admin = (await api('/auth/login','POST',{email:'admin@ci.example',password})).body.accessToken;
  assert.ok(admin);
  for(const name of ['Ana','Mateo']) assert.equal((await api('/usuarios','POST',{name,email:name.toLowerCase()+'@ci.example',password,role:'Usuario'},admin)).status,201);
  const ana=(await api('/auth/login','POST',{email:'ana@ci.example',password})).body.accessToken;
  const mateo=(await api('/auth/login','POST',{email:'mateo@ci.example',password})).body.accessToken;
  const donation=await api('/donativos','POST',{type:'Efectivo',amount:250,date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'}),notes:''},ana);
  assert.equal(donation.status,201);
  assert.equal((await api('/donativos/'+donation.body.donation.id,'GET',undefined,mateo)).status,404);
  assert.equal((await api('/donantes','GET',undefined,ana)).status,403);
  assert.equal((await api('/donativos/'+donation.body.donation.id+'/verificar','PATCH',undefined,admin)).status,200);
  assert.equal((await api('/donativos','GET',undefined,ana)).body.donations[0].status,'Verificado');
  assert.equal((await api('/auth/logout','POST',undefined,ana)).status,204);
  assert.equal((await api('/auth/me','GET',undefined,ana)).status,401);
  console.log('Staging PASS: alta, JWT, dos cuentas aisladas, donativo, verificación y revocación.');
})().catch(error=>{console.error(error);process.exit(1);});
