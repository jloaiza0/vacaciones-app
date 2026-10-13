const express = require('express');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('../db/connection');
const { crearSesion, cerrarSesion, cerrarOtrasSesiones, requireSesion } = require('../middleware/auth');

const router = express.Router();

const CLAVE_POR_DEFECTO = 'admin123'; // la misma que usa index.js al crear el usuario inicial
const LARGO_MINIMO = 8;

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const db = obtenerConexion();
  const admin = db.prepare('SELECT * FROM usuario_admin WHERE id = 1').get();

  if (!admin || admin.usuario !== usuario || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = crearSesion();
  res.cookie('sesion', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true, debeCambiarPassword: Boolean(admin.debe_cambiar_password) });
});

router.post('/logout', (req, res) => {
  cerrarSesion(req.cookies?.sesion);
  res.clearCookie('sesion');
  res.json({ ok: true });
});

// Cambiar la contraseña del único usuario editor (voluntario u obligatorio)
router.post('/cambiar-password', requireSesion, (req, res) => {
  const { passwordActual, passwordNueva } = req.body;
  const db = obtenerConexion();
  const admin = db.prepare('SELECT * FROM usuario_admin WHERE id = 1').get();

  if (!admin || !bcrypt.compareSync(passwordActual || '', admin.password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  if (typeof passwordNueva !== 'string' || passwordNueva.length < LARGO_MINIMO) {
    return res.status(400).json({ error: `La nueva contraseña debe tener al menos ${LARGO_MINIMO} caracteres` });
  }
  if (passwordNueva === passwordActual) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
  }
  if (passwordNueva === CLAVE_POR_DEFECTO) {
    return res.status(400).json({ error: 'Esa contraseña es la de fábrica; elige otra' });
  }

  const nuevoHash = bcrypt.hashSync(passwordNueva, 10);
  db.prepare('UPDATE usuario_admin SET password_hash = ?, debe_cambiar_password = 0 WHERE id = 1').run(nuevoHash);
  cerrarOtrasSesiones(req.cookies?.sesion);
  res.json({ ok: true });
});

module.exports = router;