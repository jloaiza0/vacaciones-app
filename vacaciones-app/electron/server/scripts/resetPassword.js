// Restablece la contraseña del usuario admin a una clave temporal aleatoria.
// Uso (desde la carpeta del proyecto, en la máquina principal):
//   node electron/server/scripts/resetPassword.js
// Al iniciar sesión con la clave temporal, la app obliga a elegir una nueva.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { obtenerConexion } = require('../db/connection');

function generarClaveTemporal() {
  // Sin caracteres ambiguos (0/O, 1/l/I) para que sea fácil de leer y copiar
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
}

const db = obtenerConexion();
const admin = db.prepare('SELECT usuario FROM usuario_admin WHERE id = 1').get();

if (!admin) {
  console.error('Todavía no existe el usuario admin. Arranca la app una vez para que se cree y vuelve a intentar.');
  process.exit(1);
}

const temporal = generarClaveTemporal();
db.prepare('UPDATE usuario_admin SET password_hash = ?, debe_cambiar_password = 1 WHERE id = 1').run(
  bcrypt.hashSync(temporal, 10)
);

console.log('');
console.log('Contraseña restablecida.');
console.log(`  Usuario:              ${admin.usuario}`);
console.log(`  Contraseña temporal:  ${temporal}`);
console.log('Al iniciar sesión, la app te pedirá elegir una contraseña nueva.');
console.log('');