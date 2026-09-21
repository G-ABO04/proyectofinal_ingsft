// Prueba de navegador contra una base VACÍA y desechable en el puerto 3100.
// Requiere Chrome con --headless=new --remote-debugging-port=9228.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
(async () => {
  const targets = await (await fetch('http://127.0.0.1:9228/json')).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open',resolve,{once:true}));
  let seq = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', ({data}) => {
    const message = JSON.parse(data);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(message.error) : item.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  });
  function cdp(method,params={}) { return new Promise((resolve,reject) => { const id=++seq; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
  async function run(expression) { const response = await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails)); return response.result.value; }
  async function until(expression) { for(let n=0;n<100;n++) { if(await run(expression))return; await delay(100); } throw Error('Timeout: '+expression+' '+await run('document.body.innerText.slice(-1600)')); }
  const fill = (selector,value) => run(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
  const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const submit = selector => run(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
  const screenshot = async name => { await delay(400);  const result=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); fs.mkdirSync(path.resolve(__dirname,'../../reports'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../../reports/'+name+'.png'),Buffer.from(result.data,'base64')); };
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:process.env.QA_ORIGIN || 'http://127.0.0.1:3100'});
  await until('document.querySelector("#setup-form") && !document.querySelector("#setup-form").hidden');
  await screenshot('setup');
  await fill('#setup-name','Administración QA');await fill('#setup-email','admin@qa.example');await fill('#setup-password','Una clave de pruebas 2026!');await fill('#setup-token','ui-qa-only-setup-token-2026-abcdefghijklmnopqrstuvwxyz');await submit('#setup-form');
  await until('document.querySelector("#setup-form").hidden');
  async function login(email) { await fill('#login-email',email); await fill('#login-password','Una clave de pruebas 2026!'); await submit('#login-form'); await until('document.querySelector("#login-screen").hidden && (!document.querySelector("#app").hidden || !document.querySelector("#donor-portal").hidden)'); }
  await login('admin@qa.example');
  await until('document.querySelector("#account-name").textContent.includes("QA")');
  await screenshot('admin');
  for(const [name,email] of [['Ana QA','ana@qa.example'],['Mateo QA','mateo@qa.example']]) {
    await click('[data-page="usuarios"]');await click('[data-action="new-user"]');
    await fill('#user-name',name);await fill('#user-email',email);await fill('#user-password','Una clave de pruebas 2026!');await submit('#user-form');await until('!document.querySelector("#modal").open');
  }
  await click('#logout');await until('!document.querySelector("#login-screen").hidden');
  await screenshot('login');await login('ana@qa.example');
  await until('document.querySelector("#donor-greeting").textContent.includes("Ana")');
  assert.equal(await run('document.querySelector("#app").hidden'),true);
  assert.equal(await run('document.querySelector("#users-body").textContent'), '');
  await screenshot('donor-empty');
  await click('[data-donor-page="aportar"]');await click('[data-amount="1000"]');await click('#personal-confirm');await submit('#personal-donation-form');
  await until('document.querySelector("#modal").open && document.querySelector(".donor-success") !== null');await click('.donor-success [data-close-modal]');
  assert.match(await run('document.querySelector("#donor-history-list").textContent'),/DON-0001/);
  await click('[data-donor-page="aportar"]');await click('#personal-donation-form input[value="Especie"]');await fill('#personal-description','10 cajas de alimentos <img src=x onerror=alert(1)>');await click('#personal-confirm');await submit('#personal-donation-form');await until('document.querySelector("#modal").open && document.querySelector(".donor-success") !== null');await click('.donor-success [data-close-modal]');
  assert.equal(await run('document.querySelectorAll("#donor-history-list img").length'),0);
  await click('[data-donor-page="inicio"]');await screenshot('donor-home');
  await click('#donor-account-toggle');await click('[data-donor-page="perfil"]');await fill('#personal-name','Ana Actualizada');await fill('#personal-phone','5512345678');await submit('#personal-profile-form');await until('document.querySelector("#donor-profile-name").textContent === "Ana Actualizada"');
  await run('location.hash="/administracion/usuarios"');await until('location.hash === "#/mi-espacio/inicio"');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await screenshot('donor-mobile');
  assert.equal(await run('document.documentElement.scrollWidth <= window.innerWidth'),true);
  await click('#donor-account-toggle');await click('#donor-logout');await until('!document.querySelector("#login-screen").hidden');await login('mateo@qa.example');await until('document.querySelector("#donor-greeting").textContent.includes("Mateo")');
  assert.equal(await run('document.querySelector("#donor-history-summary").textContent.startsWith("0 aportaciones")'),true);
  const privacy = await run(`(async()=>{const headers={Authorization:'Bearer '+sessionStorage.getItem('donativoSeguro.accessToken')};return Promise.all(['/api/donativos/DON-0001','/api/usuarios','/api/donantes'].map(async url=>(await fetch(url,{headers})).status))})()`);
  assert.deepEqual(privacy,[404,403,403]);
  await click('#donor-account-toggle');await click('#donor-logout');await until('!document.querySelector("#login-screen").hidden');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await login('admin@qa.example');await until('document.querySelector("#donations-body").textContent.includes("DON-0001")');await click('[data-page="donativos"]');await click('[data-action="view-donation"][data-id="DON-0001"]');await until('document.querySelector("[data-action=verify-donation]") !== null');await click('[data-action="verify-donation"]');await until('!document.querySelector("#modal").open');
  await cdp('Page.reload');await until('!document.querySelector("#app").hidden && document.querySelector("#donations-body").textContent.includes("Verificado")');
  await screenshot('admin-donations');
  assert.deepEqual(errors,[]);
  console.log('UI QA PASS: instalación, cuentas reales, efectivo/especie, perfil, XSS como texto, privacidad entre dos usuarios, rutas, móvil, verificación y recarga.');
  ws.close();
})().catch(error=>{console.error(error);process.exit(1);});
