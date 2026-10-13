const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('./db/connection');
const { requireAuth } = require('./middleware/auth');
const { actualizarEstadosPorVencimiento } = require('./services/calculoVacaciones');

const authRoutes = require('./routes/auth');
const trabajadoresRoutes = require('./routes/trabajadores');
const periodosRoutes = require('./routes/periodos');
const consultaRoutes = require('./routes/consulta');
const importadorRoutes = require('./routes/importador');

const PUERTO = process.env.PUERTO || 4321;
const CLAVE_POR_DEFECTO = 'admin123'; // la misma que usa routes/auth.js
const app = express();

app.use(express.json());
app.use(cookieParser());

// Crea la BD si hace falta y prepara el usuario admin.
// - Primera vez: se crea con la clave de fábrica y obligando a cambiarla.
// - Si ya existe y sigue con la clave de fábrica, también se obliga a cambiarla.
const db = obtenerConexion();
const admin = db.prepare('SELECT * FROM usuario_admin WHERE id = 1').get();
if (!admin) {
  const hash = bcrypt.hashSync(CLAVE_POR_DEFECTO, 10);
  db.prepare(
    'INSERT INTO usuario_admin (id, usuario, password_hash, debe_cambiar_password) VALUES (1, ?, ?, 1)'
  ).run('admin', hash);
  console.log('Usuario inicial creado (usuario "admin"). Al iniciar sesión se pedirá elegir una contraseña nueva.');
} else if (!admin.debe_cambiar_password && bcrypt.compareSync(CLAVE_POR_DEFECTO, admin.password_hash)) {
  db.prepare('UPDATE usuario_admin SET debe_cambiar_password = 1 WHERE id = 1').run();
  console.log('La contraseña sigue siendo la de fábrica: se pedirá cambiarla al iniciar sesión.');
}

// Los periodos se vencen con el paso del tiempo aunque nadie los edite: se revisan al
// arrancar y luego cada hora (por si el servidor queda encendido varios días seguidos).
function revisarVencimientos() {
  try {
    actualizarEstadosPorVencimiento();
  } catch (err) {
    console.error('No se pudieron actualizar los estados por vencimiento:', err.message);
  }
}
revisarVencimientos();
setInterval(revisarVencimientos, 60 * 60 * 1000);

app.use('/api/auth', authRoutes);
app.use('/api/trabajadores', requireAuth, trabajadoresRoutes);
app.use('/api/periodos', requireAuth, periodosRoutes);
app.use('/api/importador', requireAuth, importadorRoutes);
app.use('/api/consulta', consultaRoutes); // sin login: solo lectura, campos limitados

// Sirve el front ya compilado (npm run build:web) cuando la app está empaquetada
app.use(express.static(path.join(__dirname, '../../dist')));

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PUERTO} (accesible desde la red local)`);
});

module.exports = app;