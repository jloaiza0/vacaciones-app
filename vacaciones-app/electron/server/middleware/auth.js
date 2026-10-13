const crypto = require('crypto');
const { obtenerConexion } = require('../db/connection');

// Sesiones en memoria: como es un solo usuario editor y la app corre localmente,
// no hace falta nada más pesado (JWT, base de datos de sesiones, etc.)
const sesiones = new Map(); // token -> fecha de expiración
const DURACION_SESION_MS = 1000 * 60 * 60 * 12; // 12 horas

function crearSesion() {
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, Date.now() + DURACION_SESION_MS);
  return token;
}

function sesionValida(req) {
  const token = req.cookies?.sesion;
  const expira = token && sesiones.get(token);
  return Boolean(expira) && expira >= Date.now();
}

// Solo exige haber iniciado sesión. Se usa en "cambiar contraseña", que tiene que
// funcionar incluso cuando el cambio es obligatorio.
function requireSesion(req, res, next) {
  if (!sesionValida(req)) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

// Exige sesión iniciada Y que no esté pendiente el cambio obligatorio de contraseña.
// Así, mientras siga la clave de fábrica (o una temporal), esa sesión no sirve para nada
// más que para cambiarla, aunque alguien llame a la API directamente.
function requireAuth(req, res, next) {
  if (!sesionValida(req)) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const admin = obtenerConexion()
    .prepare('SELECT debe_cambiar_password FROM usuario_admin WHERE id = 1')
    .get();
  if (admin && admin.debe_cambiar_password) {
    return res.status(403).json({
      error: 'Debes cambiar la contraseña antes de continuar',
      codigo: 'CAMBIO_OBLIGATORIO',
    });
  }
  next();
}

function cerrarSesion(token) {
  sesiones.delete(token);
}

// Tras cambiar la contraseña se cierran todas las demás sesiones abiertas
function cerrarOtrasSesiones(tokenActual) {
  for (const token of sesiones.keys()) {
    if (token !== tokenActual) sesiones.delete(token);
  }
}

module.exports = { crearSesion, requireSesion, requireAuth, cerrarSesion, cerrarOtrasSesiones };