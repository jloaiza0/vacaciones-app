const express = require('express');
const { obtenerConexion } = require('../db/connection');

const router = express.Router();

function fechaIngresoValida(fecha) {
  if (!fecha) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return fecha <= hoy;
}

router.get('/', (req, res) => {
  const db = obtenerConexion();
  const { estado } = req.query; // 'activos' | 'inactivos' | 'todos'
  let sql = 'SELECT * FROM trabajadores';
  if (estado === 'activos') sql += ' WHERE activo = 1';
  if (estado === 'inactivos') sql += ' WHERE activo = 0';
  sql += ' ORDER BY nombre';
  res.json(db.prepare(sql).all());
});

router.get('/:id', (req, res) => {
  const db = obtenerConexion();
  const trabajador = db.prepare('SELECT * FROM trabajadores WHERE id = ?').get(req.params.id);
  if (!trabajador) return res.status(404).json({ error: 'No encontrado' });
  const periodos = db
    .prepare('SELECT * FROM periodos_vacaciones WHERE trabajador_id = ? ORDER BY periodo_pago_inicio DESC')
    .all(req.params.id);
  res.json({ ...trabajador, periodos });
});

router.post('/', (req, res) => {
  const db = obtenerConexion();
  const { cedula, nombre, fecha_ingreso, firmado, salario } = req.body;
  if (!fechaIngresoValida(fecha_ingreso)) {
    return res.status(400).json({ error: 'La fecha de ingreso no puede ser posterior a hoy' });
  }
  const info = db
    .prepare(
      `INSERT INTO trabajadores (cedula, nombre, fecha_ingreso, firmado, salario)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(cedula, nombre, fecha_ingreso, firmado, salario);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const db = obtenerConexion();
  const { cedula, nombre, fecha_ingreso, firmado, salario } = req.body;
  if (!fechaIngresoValida(fecha_ingreso)) {
    return res.status(400).json({ error: 'La fecha de ingreso no puede ser posterior a hoy' });
  }
  db.prepare(
    `UPDATE trabajadores SET cedula=?, nombre=?, fecha_ingreso=?, firmado=?, salario=?,
       actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(cedula, nombre, fecha_ingreso, firmado, salario, req.params.id);
  res.json({ ok: true });
});

// Soft delete: nunca se borra de verdad desde acá
router.delete('/:id', (req, res) => {
  const db = obtenerConexion();
  db.prepare("UPDATE trabajadores SET activo = 0, actualizado_en = datetime('now') WHERE id = ?").run(
    req.params.id
  );
  res.json({ ok: true });
});

router.post('/:id/activar', (req, res) => {
  const db = obtenerConexion();
  db.prepare("UPDATE trabajadores SET activo = 1, actualizado_en = datetime('now') WHERE id = ?").run(
    req.params.id
  );
  res.json({ ok: true });
});

module.exports = router;