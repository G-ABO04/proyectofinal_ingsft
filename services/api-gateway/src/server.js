const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', createProxyMiddleware({ target: 'http://auth-service:3001', changeOrigin: true }));
app.use('/api/usuarios', createProxyMiddleware({ target: 'http://user-service:3002', changeOrigin: true }));
app.use('/api/donantes', createProxyMiddleware({ target: 'http://donor-service:3003', changeOrigin: true }));
app.use('/api/donativos', createProxyMiddleware({ target: 'http://donation-service:3004', changeOrigin: true }));
app.use('/api/gastos', createProxyMiddleware({ target: 'http://expense-service:3005', changeOrigin: true }));
app.use('/api/fiscal', createProxyMiddleware({ target: 'http://tax-service:3006', changeOrigin: true }));
app.use('/api/contabilidad', createProxyMiddleware({ target: 'http://accounting-service:3007', changeOrigin: true }));

const frontendPath = process.env.FRONTEND_PATH || path.resolve(__dirname, '../../../frontend');
app.use(express.static(frontendPath, { dotfiles: 'deny', etag: true }));
app.use((req, res) => res.status(404).send('Página no encontrada.'));

app.listen(PORT, () => {
  console.log(`API Gateway escuchando en el puerto ${PORT}`);
});
