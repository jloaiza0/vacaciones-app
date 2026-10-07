const express = require('express');
const { obtenerConexion } = require('../db/connection');
const { generarPeriodo, recalcularPeriodo, diasDisponiblesParaToma } = require('../services/calculoVacaciones');

const router = express.Router();

const ESTADOS_VALIDOS = ['Sin vencer', 'Pendiente', 'Disfrutado', 'Anticipadas'];

function esNumeroPositivo(v) {
  return typeof v === 'number' ? v >= 0 && Number.isFinite(v) : v !== '' && !isNaN(v) && Number(v) >= 0;
}

function fechaFinValida(inicio, fin) {
  return inicio && fin && fin >= inicio;
}

router.post('/', (req, res) => {
  const { trabajador_id, periodo_pago_inicio } = req.body;
  const id = generarPeriodo(trabajador_id, periodo_pago_inicio);
  res.status(201).json(recalcularPeriodo(id));
});

router.get('/:id', (req, res) => {
  const db = obtenerConexion();
  const periodo = db
    .prepare(
      `SELECT p.*, t.salario AS salario_trabajador, t.nombre AS nombre_trabajador
       FROM periodos_vacaciones p JOIN trabajadores t ON t.id = p.trabajador_id
       WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!periodo) return res.status(404).json({ error: 'No encontrado' });
  periodo.tomas = db.prepare('SELECT * FROM tomas_vacaciones WHERE periodo_id = ?').all(req.params.id);
  periodo.suspensiones = db
    .prepare('SELECT * FROM suspensiones_contrato WHERE periodo_id = ?')
    .all(req.params.id);
  periodo.licencias = db
    .prepare('SELECT * FROM licencias_no_remuneradas WHERE periodo_id = ?')
    .all(req.params.id);
  res.json(periodo);
});

router.put('/:id', (req, res) => {
  const db = obtenerConexion();
  const { fecha_liquidacion, estado, comentario } = req.body;
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  db.prepare(
    `UPDATE periodos_vacaciones SET
       fecha_liquidacion=?, estado=?, comentario=?, actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(fecha_liquidacion || null, estado, comentario || null, req.params.id);
  res.json(recalcularPeriodo(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = obtenerConexion();
  db.prepare('DELETE FROM periodos_vacaciones WHERE id = ?').run(req.params.id); // cascada: borra tomas/SC/LNR
  res.json({ ok: true });
});

// --- Tomas de vacaciones ---
function validarToma(req, res, tomaIdExcluir) {
  const { fecha_inicio, fecha_fin, habiles_disfrutados, habiles_pagos, total_dias_disfrutados, compensacion_dinero } =
    req.body;

  if (!fechaFinValida(fecha_inicio, fecha_fin)) {
    res.status(400).json({ error: 'La fecha fin no puede ser anterior a la fecha inicio' });
    return null;
  }
  for (const [nombre, valor] of [
    ['habiles_disfrutados', habiles_disfrutados],
    ['habiles_pagos', habiles_pagos],
    ['total_dias_disfrutados', total_dias_disfrutados],
    ['compensacion_dinero', compensacion_dinero],
  ]) {
    if (!esNumeroPositivo(valor)) {
      res.status(400).json({ error: `${nombre} debe ser un número positivo` });
      return null;
    }
  }

  const disponibles = diasDisponiblesParaToma(req.params.id, tomaIdExcluir);
  const solicitados = Number(habiles_disfrutados) + Number(habiles_pagos);
  if (solicitados > disponibles) {
    res.status(400).json({
      error: `Hábiles disfrutados + hábiles pagos (${solicitados}) supera los días pendientes disponibles (${disponibles})`,
    });
    return null;
  }

  return {
    fecha_inicio,
    fecha_fin,
    habiles_disfrutados: Number(habiles_disfrutados),
    habiles_pagos: Number(habiles_pagos),
    total_dias_disfrutados: Number(total_dias_disfrutados),
    compensacion_dinero: Number(compensacion_dinero),
    comentario: req.body.comentario || null,
  };
}

router.post('/:id/tomas', (req, res) => {
  const datos = validarToma(req, res, null);
  if (!datos) return;
  const db = obtenerConexion();
  db.prepare(
    `INSERT INTO tomas_vacaciones
       (periodo_id, fecha_inicio, fecha_fin, habiles_disfrutados, habiles_pagos, total_dias_disfrutados, compensacion_dinero, comentario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.params.id,
    datos.fecha_inicio,
    datos.fecha_fin,
    datos.habiles_disfrutados,
    datos.habiles_pagos,
    datos.total_dias_disfrutados,
    datos.compensacion_dinero,
    datos.comentario
  );
  res.status(201).json(recalcularPeriodo(req.params.id));
});

router.put('/:id/tomas/:tomaId', (req, res) => {
  const datos = validarToma(req, res, req.params.tomaId);
  if (!datos) return;
  const db = obtenerConexion();
  db.prepare(
    `UPDATE tomas_vacaciones SET
       fecha_inicio=?, fecha_fin=?, habiles_disfrutados=?, habiles_pagos=?, total_dias_disfrutados=?,
       compensacion_dinero=?, comentario=?
     WHERE id = ? AND periodo_id = ?`
  ).run(
    datos.fecha_inicio,
    datos.fecha_fin,
    datos.habiles_disfrutados,
    datos.habiles_pagos,
    datos.total_dias_disfrutados,
    datos.compensacion_dinero,
    datos.comentario,
    req.params.tomaId,
    req.params.id
  );
  res.json(recalcularPeriodo(req.params.id));
});

router.delete('/:id/tomas/:tomaId', (req, res) => {
  const db = obtenerConexion();
  db.prepare('DELETE FROM tomas_vacaciones WHERE id = ? AND periodo_id = ?').run(req.params.tomaId, req.params.id);
  res.json(recalcularPeriodo(req.params.id));
});

// --- Suspensiones de contrato ---
function validarRangoConDias(req, res) {
  const { fecha_inicio, fecha_fin, dias } = req.body;
  if (!fechaFinValida(fecha_inicio, fecha_fin)) {
    res.status(400).json({ error: 'La fecha fin no puede ser anterior a la fecha inicio' });
    return null;
  }
  if (!esNumeroPositivo(dias)) {
    res.status(400).json({ error: 'Los días deben ser un número positivo' });
    return null;
  }
  return { fecha_inicio, fecha_fin, dias: Number(dias), comentario: req.body.comentario || null };
}

router.post('/:id/suspensiones', (req, res) => {
  const datos = validarRangoConDias(req, res);
  if (!datos) return;
  const db = obtenerConexion();
  db.prepare(
    'INSERT INTO suspensiones_contrato (periodo_id, fecha_inicio, fecha_fin, dias, comentario) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, datos.fecha_inicio, datos.fecha_fin, datos.dias, datos.comentario);
  res.status(201).json(recalcularPeriodo(req.params.id));
});

router.put('/:id/suspensiones/:suspId', (req, res) => {
  const datos = validarRangoConDias(req, res);
  if (!datos) return;
  const db = obtenerConexion();
  db.prepare(
    'UPDATE suspensiones_contrato SET fecha_inicio=?, fecha_fin=?, dias=?, comentario=? WHERE id = ? AND periodo_id = ?'
  ).run(datos.fecha_inicio, datos.fecha_fin, datos.dias, datos.comentario, req.params.suspId, req.params.id);
  res.json(recalcularPeriodo(req.params.id));
});

router.delete('/:id/suspensiones/:suspId', (req, res) => {
  const db = obtenerConexion();
  db.prepare('DELETE FROM suspensiones_contrato WHERE id = ? AND periodo_id = ?').run(
    req.params.suspId,
    req.params.id
  );
  res.json(recalcularPeriodo(req.params.id));
});

// --- Licencias no remuneradas ---
router.post('/:id/licencias', (req, res) => {
  const datos = validarRangoConDias(req, res);
  if (!datos) return;
  const db = obtenerConexion();
  db.prepare(
    'INSERT INTO licencias_no_remuneradas (periodo_id, fecha_inicio, fecha_fin, dias, comentario) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, datos.fecha_inicio, datos.fecha_fin, datos.dias, datos.comentario);
  res.status(201).json(recalcularPeriodo(req.params.id));
});

router.put('/:id/licencias/:licId', (req, res) => {
  const datos = validarRangoConDias(req, res);
  if (!datos) return;
  const db = obtenerConexion();
  db.prepare(
    'UPDATE licencias_no_remuneradas SET fecha_inicio=?, fecha_fin=?, dias=?, comentario=? WHERE id = ? AND periodo_id = ?'
  ).run(datos.fecha_inicio, datos.fecha_fin, datos.dias, datos.comentario, req.params.licId, req.params.id);
  res.json(recalcularPeriodo(req.params.id));
});

router.delete('/:id/licencias/:licId', (req, res) => {
  const db = obtenerConexion();
  db.prepare('DELETE FROM licencias_no_remuneradas WHERE id = ? AND periodo_id = ?').run(
    req.params.licId,
    req.params.id
  );
  res.json(recalcularPeriodo(req.params.id));
});

module.exports = router;