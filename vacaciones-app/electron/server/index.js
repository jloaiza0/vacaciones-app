const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('./db/connection');
const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const trabajadoresRoutes = require('./routes/trabajadores');
const periodosRoutes = require('./routes/periodos');
const consultaRoutes = require('./routes/consulta');
const importadorRoutes = require('./routes/importador');

const PUERTO = process.env.PUERTO || 4321;
const app = express();

app.use(express.json());
app.use(cookieParser());

// Crea la BD si hace falta y siembra el usuario admin por defecto la primera vez
const db = obtenerConexion();
const admin = db.prepare('SELECT * FROM usuario_admin WHERE id = 1').get();
if (!admin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuario_admin (id, usuario, password_hash) VALUES (1, ?, ?)').run('admin', hash);
  console.log('Usuario admin creado: usuario "admin", contraseña "admin123" — cámbiala luego desde la app.');
}

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
