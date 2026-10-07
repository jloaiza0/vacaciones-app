const crypto = require('crypto');

// Sesiones en memoria: como es un solo usuario editor y la app corre localmente,
// no hace falta nada más pesado (JWT, base de datos de sesiones, etc.)
const sesiones = new Map(); // token -> fecha de expiración
const DURACION_SESION_MS = 1000 * 60 * 60 * 12; // 12 horas

function crearSesion() {
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, Date.now() + DURACION_SESION_MS);
  return token;
}

function requireAuth(req, res, next) {
  const token = req.cookies?.sesion;
  const expira = token && sesiones.get(token);
  if (!expira || expira < Date.now()) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

function cerrarSesion(token) {
  sesiones.delete(token);
}

module.exports = { crearSesion, requireAuth, cerrarSesion };
