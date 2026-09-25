const jwt = require('jsonwebtoken');
const { publicUser } = require('../data/usuarios');

function authenticate(db, config) {
  return (req, res, next) => {
    try {
      const authorization = req.get('Authorization') || '';
      if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
      const claims = jwt.verify(authorization.slice(7), config.jwtSecret, { algorithms: ['HS256'], issuer: 'donativoseguro', audience: 'donativoseguro-web' });
      const session = db.prepare('SELECT user_id FROM sessions WHERE id=? AND expires_at>?').get(claims.jti, Math.floor(Date.now() / 1000));
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(claims.sub);
      if (!session || session.user_id !== claims.sub || !user?.active) return res.status(401).json({ error: 'La sesión ya no está activa. Inicia sesión nuevamente.' });
      req.user = publicUser(user);
      req.sessionId = claims.jti;
      next();
    } catch { res.status(401).json({ error: 'La sesión expiró o no es válida.' }); }
  };
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'Administrador') return res.status(403).json({ error: 'Esta acción requiere una cuenta de administrador.' });
  next();
}

module.exports = { authenticate, adminOnly };
