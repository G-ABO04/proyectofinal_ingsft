const path = require('node:path');

function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET || '';
  if (jwtSecret.length < 32 || jwtSecret.startsWith('GENERAR_')) throw new Error('Configura un JWT_SECRET aleatorio de al menos 32 caracteres. Ejecuta npm run configure.');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no es válido.');
  const production = env.NODE_ENV === 'production';
  const publicOrigin = env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`;
  const url = new URL(publicOrigin);
  if (production && url.protocol !== 'https:') throw new Error('PUBLIC_ORIGIN debe usar HTTPS en producción.');
  return {
    port, production, jwtSecret, publicOrigin: url.origin,
    host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    databasePath: path.resolve(__dirname, '..', env.DATABASE_PATH || '../../database/donativoseguro.sqlite'),
    setupToken: env.SETUP_TOKEN || '',
    trustProxy: env.TRUST_PROXY === '1' ? 1 : false,
    loginMax: 10,
    tokenSeconds: 1800
  };
}

module.exports = { loadConfig };
