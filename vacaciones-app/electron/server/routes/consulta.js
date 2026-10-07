const express = require('express');
const { obtenerConexion } = require('../db/connection');

const router = express.Router();

// Lista de trabajadores activos (solo nombre y cédula) que coinciden con la búsqueda
router.get('/trabajadores', (req, res) => {
  const db = obtenerConexion();
  const { q } = req.query;

  const filas = db
    .prepare('SELECT id, nombre, cedula FROM trabajadores WHERE activo = 1 ORDER BY nombre')
    .all();

  const filtradas = q
    ? filas.filter((f) => f.nombre.toLowerCase().includes(q.toLowerCase()) || f.cedula.includes(q))
    : filas;

  res.json(filtradas);
});

// Periodos de un trabajador puntual (sin salario ni datos internos del trabajador)
router.get('/trabajadores/:id', (req, res) => {
  const db = obtenerConexion();
  const trabajador = db
    .prepare('SELECT id, nombre, cedula FROM trabajadores WHERE id = ? AND activo = 1')
    .get(req.params.id);
  if (!trabajador) return res.status(404).json({ error: 'No encontrado' });

  const periodos = db
    .prepare(
      `SELECT id, periodo_pago_inicio, periodo_pago_fin, estado, dias_pendientes
       FROM periodos_vacaciones WHERE trabajador_id = ? ORDER BY periodo_pago_inicio DESC`
    )
    .all(req.params.id);

  res.json({ ...trabajador, periodos });
});

// Detalle completo de un periodo, solo lectura
router.get('/periodos/:id', (req, res) => {
  const db = obtenerConexion();
  const periodo = db
    .prepare(
      `SELECT p.id, p.trabajador_id, p.periodo_pago_inicio, p.periodo_pago_fin, p.estado, p.dias_pendientes,
              p.fecha_liquidacion, p.comentario, t.nombre, t.cedula
       FROM periodos_vacaciones p JOIN trabajadores t ON t.id = p.trabajador_id
       WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!periodo) return res.status(404).json({ error: 'No encontrado' });

  periodo.tomas = db
    .prepare(
      `SELECT fecha_inicio, fecha_fin, habiles_disfrutados, habiles_pagos, total_dias_disfrutados,
              compensacion_dinero, comentario, id
       FROM tomas_vacaciones WHERE periodo_id = ?`
    )
    .all(req.params.id);
  periodo.suspensiones = db
    .prepare('SELECT * FROM suspensiones_contrato WHERE periodo_id = ?')
    .all(req.params.id);
  periodo.licencias = db
    .prepare('SELECT * FROM licencias_no_remuneradas WHERE periodo_id = ?')
    .all(req.params.id);

  res.json(periodo);
});

module.exports = router;