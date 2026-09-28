const express = require('express');
const { authRoutes } = require('../services/auth-service/src/routes/auth.routes');
const { userRoutes } = require('../services/user-service/src/routes/usuarios.routes');
const { donorRoutes } = require('../services/donor-service/src/routes/donantes.routes');
const { donationRoutes } = require('../services/donation-service/src/routes/donativos.routes');
const { expenseRoutes } = require('../services/expense-service/src/routes/expense.routes');
const { taxRoutes } = require('../services/tax-service/src/routes/tax.routes');
const { accountingRoutes } = require('../services/accounting-service/src/routes/accounting.routes');
const { authenticate } = require('../services/auth-service/src/middleware/auth.middleware');

function createApp({ db, config, requestLog = console.info }) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  
  const helmet = require('helmet');
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  // app.use(helmet({ crossOriginEmbedderPolicy: true, contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], fontSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } }, strictTransportSecurity: config.production ? undefined : false }));
  app.use((req, res, next) => { res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); next(); });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin && origin !== config.publicOrigin) return res.status(403).json({ error: 'Origen no permitido.' });
    next();
  });
  app.get('/api/health', (req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.use('/api/auth', authRoutes(db, config));
  app.use('/api/usuarios', authenticate(db, config), userRoutes(db));
  app.use('/api/donantes', authenticate(db, config), donorRoutes(db));
  app.use('/api/donativos', authenticate(db, config), donationRoutes(db));
  app.use('/api/gastos', authenticate(db, config), expenseRoutes(db));
  app.use('/api/fiscal', authenticate(db, config), taxRoutes(db));
  app.use('/api/contabilidad', authenticate(db, config), accountingRoutes(db));
  
  const path = require('node:path');
  app.use(express.static(path.resolve(__dirname, '../frontend'), { dotfiles: 'deny', etag: true }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((req, res) => res.status(404).send('Página no encontrada.'));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'El formato JSON no es válido.' });
    if (error.code?.startsWith('ERR_SQLITE') && /UNIQUE constraint/.test(error.message)) return res.status(409).json({ error: 'El correo ya está registrado en ese espacio.' });
    if (error.code?.startsWith('ERR_SQLITE') && /constraint/i.test(error.message)) return res.status(400).json({ error: 'Los datos no cumplen las reglas de registro.' });
    res.status(500).json({ error: 'No fue posible completar la operación. Intenta nuevamente.' });
  });
  return app;
}
module.exports = { createApp };
