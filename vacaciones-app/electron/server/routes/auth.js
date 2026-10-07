const express = require('express');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('../db/connection');
const { crearSesion, cerrarSesion } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const db = obtenerConexion();
  const admin = db.prepare('SELECT * FROM usuario_admin WHERE id = 1').get();

  if (!admin || admin.usuario !== usuario || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = crearSesion();
  res.cookie('sesion', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  cerrarSesion(req.cookies?.sesion);
  res.clearCookie('sesion');
  res.json({ ok: true });
});

// Cambiar la contraseña del único usuario editor
router.post('/cambiar-password', (req, res) => {
  const { passwordActual, passwordNueva } = req.body;
  const db = obtenerConexion();
  const admin = db.prepare('SELECT * FROM usuario_admin WHERE id = 1').get();

  if (!admin || !bcrypt.compareSync(passwordActual || '', admin.password_hash)) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }

  const nuevoHash = bcrypt.hashSync(passwordNueva, 10);
  db.prepare('UPDATE usuario_admin SET password_hash = ? WHERE id = 1').run(nuevoHash);
  res.json({ ok: true });
});

module.exports = router;
