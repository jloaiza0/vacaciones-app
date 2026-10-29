const express = require('express');
const { obtenerConexion } = require('../db/connection');
const { hoyLocalISO } = require('../services/calculoVacaciones');
const { crearRespaldoSeguridad } = require('../services/respaldos');
const { normalizarCedula, parsearSalario, fechaISOValida } = require('../utils/texto');

const router = express.Router();

// Valida y limpia lo que llega del formulario. Devuelve { datos } o { error }.
function validarTrabajador(cuerpo) {
  const cedula = normalizarCedula(cuerpo.cedula);
  const nombre = String(cuerpo.nombre ?? '').trim().replace(/\s+/g, ' ');
  const fechaIngreso = cuerpo.fecha_ingreso;

  if (!cedula) return { error: 'La cédula es obligatoria' };
  if (!nombre) return { error: 'El nombre es obligatorio' };
  if (!fechaISOValida(fechaIngreso)) return { error: 'La fecha de ingreso no es válida' };
  if (fechaIngreso > hoyLocalISO()) return { error: 'La fecha de ingreso no puede ser posterior a hoy' };

  const salario = parsearSalario(cuerpo.salario);
  if (!salario.ok) {
    return { error: 'El salario no es válido. Escribe solo números, por ejemplo 3200000 o 3.200.000' };
  }

  const firmado = cuerpo.firmado ? String(cuerpo.firmado).trim() : 'No';
  return { datos: { cedula, nombre, fecha_ingreso: fechaIngreso, firmado, salario: salario.valor } };
}

function mensajeCedulaRepetida(existente) {
  return existente.activo
    ? `Ya existe un trabajador con esa cédula: ${existente.nombre}.`
    : `Ya existe un trabajador con esa cédula: ${existente.nombre} (inactivo). Búscalo en "Inactivos" o "Todos".`;
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
  const { datos, error } = validarTrabajador(req.body);
  if (error) return res.status(400).json({ error });

  const db = obtenerConexion();
  const existente = db.prepare('SELECT nombre, activo FROM trabajadores WHERE cedula = ?').get(datos.cedula);
  if (existente) return res.status(409).json({ error: mensajeCedulaRepetida(existente) });

  const info = db
    .prepare(
      `INSERT INTO trabajadores (cedula, nombre, fecha_ingreso, firmado, salario)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(datos.cedula, datos.nombre, datos.fecha_ingreso, datos.firmado, datos.salario);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { datos, error } = validarTrabajador(req.body);
  if (error) return res.status(400).json({ error });

  const db = obtenerConexion();
  if (!db.prepare('SELECT id FROM trabajadores WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  const existente = db
    .prepare('SELECT nombre, activo FROM trabajadores WHERE cedula = ? AND id != ?')
    .get(datos.cedula, req.params.id);
  if (existente) return res.status(409).json({ error: mensajeCedulaRepetida(existente) });

  db.prepare(
    `UPDATE trabajadores SET cedula=?, nombre=?, fecha_ingreso=?, firmado=?, salario=?,
       actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(datos.cedula, datos.nombre, datos.fecha_ingreso, datos.firmado, datos.salario, req.params.id);
  res.json({ ok: true });
});

// Desactivar (lo normal): el trabajador y todo su historial se conservan
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

// Borrado DEFINITIVO, para un trabajador creado por error. Solo se permite si ya está
// inactivo (dos pasos a propósito), y antes se guarda una copia de seguridad: si esa copia
// falla, no se borra nada. Borra también sus periodos, tomas, suspensiones y licencias.
router.delete('/:id/definitivo', async (req, res, next) => {
  try {
    const db = obtenerConexion();
    const trabajador = db.prepare('SELECT id, activo FROM trabajadores WHERE id = ?').get(req.params.id);
    if (!trabajador) return res.status(404).json({ error: 'No encontrado' });
    if (trabajador.activo) {
      return res.status(409).json({
        error: 'Primero desactiva al trabajador. El borrado definitivo solo se permite para trabajadores inactivos.',
      });
    }

    const borrados = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM periodos_vacaciones WHERE trabajador_id = @id) AS periodos,
           (SELECT COUNT(*) FROM tomas_vacaciones WHERE periodo_id IN
              (SELECT id FROM periodos_vacaciones WHERE trabajador_id = @id)) AS tomas,
           (SELECT COUNT(*) FROM suspensiones_contrato WHERE periodo_id IN
              (SELECT id FROM periodos_vacaciones WHERE trabajador_id = @id)) AS suspensiones,
           (SELECT COUNT(*) FROM licencias_no_remuneradas WHERE periodo_id IN
              (SELECT id FROM periodos_vacaciones WHERE trabajador_id = @id)) AS licencias`
      )
      .get({ id: req.params.id });

    const copia = await crearRespaldoSeguridad();
    if (!copia.local.ok) {
      return res.status(500).json({
        error: `No se borró nada: no se pudo guardar la copia de seguridad previa (${copia.local.error})`,
      });
    }

    db.prepare('DELETE FROM trabajadores WHERE id = ?').run(req.params.id); // cascada
    res.json({ ok: true, borrados });
  } catch (err) {
    next(err);
  }
});

module.exports = router;