const express = require('express');
const helmet = require('helmet');
const { authenticate } = require('./middleware/auth.middleware');
const { donorRoutes } = require('./routes/donantes.routes');

function createApp({ db, config, requestLog = console.info }) {
  const app = express();
  app.use((req, res, next) => {
    const started = performance.now();
    res.once('finish', () => {
      const duration = (performance.now() - started).toFixed(1);
      requestLog(`${req.method} ${req.path} ${res.statusCode} - ${duration} ms`);
    });
    next();
  });
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  
  app.get('/api/health', (req, res) => { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); });
  app.use('/', authenticate(db, config), donorRoutes(db));
  
  app.use((error, req, res, next) => {
    if (config.production) console.error('Error interno:', error.code || error.name);
    res.status(500).json({ error: 'No fue posible completar la operación. Intenta nuevamente.' });
  });
  return app;
}
module.exports = { createApp };
