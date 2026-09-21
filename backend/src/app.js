const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const { authenticate } = require('./middleware/auth.middleware');
const { authRoutes } = require('./routes/auth.routes');
const { userRoutes } = require('./routes/usuarios.routes');
const { donorRoutes } = require('./routes/donantes.routes');
const { donationRoutes } = require('./routes/donativos.routes');

function createApp({ db, config, requestLog = console.info }) {
  const app = express();
  app.use((req, res, next) => {
    const started = performance.now();
    const method = req.method;
    const route = req.path;
    res.once('finish', () => {
      const duration = (performance.now() - started).toFixed(1);
      requestLog(`${method} ${route} ${res.statusCode} - ${duration} ms`);
    });
    next();
  });
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({ crossOriginEmbedderPolicy: true, contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], fontSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } }, strictTransportSecurity: config.production ? undefined : false }));
  app.use((req, res, next) => { res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); next(); });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin && origin !== config.publicOrigin) return res.status(403).json({ error: 'Origen no permitido.' });
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.use('/api/auth', authRoutes(db, config));
  app.use('/api/usuarios', authenticate(db, config), userRoutes(db));
  app.use('/api/donantes', authenticate(db, config), donorRoutes(db));
  app.use('/api/donativos', authenticate(db, config), donationRoutes(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use(express.static(path.resolve(__dirname, '../../frontend'), { dotfiles: 'deny', etag: true }));
  app.use((req, res) => res.status(404).send('Página no encontrada.'));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'El formato JSON no es válido.' });
    if (error.code?.startsWith('ERR_SQLITE') && /UNIQUE constraint/.test(error.message)) return res.status(409).json({ error: 'El correo ya está registrado en ese espacio.' });
    if (error.code?.startsWith('ERR_SQLITE') && /constraint/i.test(error.message)) return res.status(400).json({ error: 'Los datos no cumplen las reglas de registro.' });
    if (config.production) console.error('Error interno:', error.code || error.name);
    res.status(500).json({ error: 'No fue posible completar la operación. Intenta nuevamente.' });
  });
  return app;
}

module.exports = { createApp };
