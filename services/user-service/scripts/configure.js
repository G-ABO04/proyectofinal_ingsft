const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const target = path.join(__dirname, '..', '.env');
if (fs.existsSync(target) && fs.readFileSync(target, 'utf8').trim()) {
  console.log('La configuración ya existe. No se modificó .env.');
} else {
  fs.writeFileSync(target, `NODE_ENV=development\nHOST=127.0.0.1\nPORT=3000\nDATABASE_PATH=./storage/donativoseguro.sqlite\nJWT_SECRET=${randomBytes(48).toString('hex')}\nSETUP_TOKEN=${randomBytes(24).toString('hex')}\nPUBLIC_ORIGIN=http://127.0.0.1:3000\nTRUST_PROXY=0\n`, { mode: 0o600 });
  console.log('Configuración creada en backend/.env. No compartas este archivo. Ejecuta npm start.');
}
