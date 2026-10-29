const express = require('express');
const { obtenerConexion } = require('../db/connection');
const {
  generarPeriodo,
  recalcularPeriodo,
  diasDisponiblesParaToma,
  sumarDias,
  redondear2,
  DIAS_CICLO,
} = require('../services/calculoVacaciones');
const { crearRespaldoSeguridad } = require('../services/respaldos');

const router = express.Router();

const ESTADOS_VALIDOS = ['Sin vencer', 'Pendiente', 'Disfrutado', 'Anticipadas'];

function esNumeroPositivo(v) {
  return typeof v === 'number' ? v >= 0 && Number.isFinite(v) : v !== '' && !isNaN(v) && Number(v) >= 0;
}

function fechaFinValida(inicio, fin) {
  return inicio && fin && fin >= inicio;
}

// 'YYYY-MM-DD' que sea una fecha real (rechaza 2026-13-45, 2026-02-30, texto, etc.)
function fechaISOValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
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

// El único estado que se decide a mano es "Anticipadas"; los otros tres se calculan solos
// en recalcularPeriodo, así que cualquier otro estado que llegue aquí se recalcula.
router.put('/:id', (req, res) => {
  const db = obtenerConexion();
  const { fecha_liquidacion, estado, comentario, periodo_pago_inicio } = req.body;
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  const actual = db
    .prepare('SELECT periodo_pago_inicio FROM periodos_vacaciones WHERE id = ?')
    .get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'Periodo no encontrado' });

  // Solo se toca el inicio si de verdad cambió: así guardar otro dato (un comentario, el
  // estado) nunca altera el fin del periodo, aunque venga de una importación con otra fecha.
  const cambiaInicio = periodo_pago_inicio !== undefined && periodo_pago_inicio !== actual.periodo_pago_inicio;
  if (cambiaInicio && !fechaISOValida(periodo_pago_inicio)) {
    return res.status(400).json({ error: 'La fecha de inicio no es válida' });
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE periodos_vacaciones SET
         fecha_liquidacion=?, estado=?, comentario=?, actualizado_en = datetime('now')
       WHERE id = ?`
    ).run(fecha_liquidacion || null, estado, comentario || null, req.params.id);

    if (cambiaInicio) {
      // Se recalcula el año a partir del nuevo inicio. Las tomas, suspensiones y licencias
      // cuelgan del id del periodo, así que se conservan tal cual; el recálculo de abajo
      // vuelve a correr el fin con los días de SC y LNR que ya tiene.
      db.prepare('UPDATE periodos_vacaciones SET periodo_pago_inicio = ?, periodo_pago_fin_base = ? WHERE id = ?').run(
        periodo_pago_inicio,
        sumarDias(periodo_pago_inicio, DIAS_CICLO),
        req.params.id
      );
    }
  })();

  res.json(recalcularPeriodo(req.params.id));
});

// Eliminar un periodo borra también sus tomas, suspensiones y licencias (cascada).
// Si tiene algo adentro, antes se guarda una copia de seguridad; si esa copia falla,
// no se borra nada.
router.delete('/:id', async (req, res, next) => {
  try {
    const db = obtenerConexion();
    if (!db.prepare('SELECT id FROM periodos_vacaciones WHERE id = ?').get(req.params.id)) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    const contar = (tabla) =>
      db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE periodo_id = ?`).get(req.params.id).n;
    const borrados = {
      tomas: contar('tomas_vacaciones'),
      suspensiones: contar('suspensiones_contrato'),
      licencias: contar('licencias_no_remuneradas'),
    };

    if (borrados.tomas + borrados.suspensiones + borrados.licencias > 0) {
      const copia = await crearRespaldoSeguridad();
      if (!copia.local.ok) {
        return res.status(500).json({
          error: `No se borró nada: no se pudo guardar la copia de seguridad previa (${copia.local.error})`,
        });
      }
    }

    db.prepare('DELETE FROM periodos_vacaciones WHERE id = ?').run(req.params.id);
    res.json({ ok: true, borrados });
  } catch (err) {
    next(err);
  }
});

// --- Tomas de vacaciones ---
// Los días de una toma admiten decimales (0,5 = medio día). La compensación es un valor
// libre en pesos: no depende de los hábiles pagos.
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

  const disfrutados = redondear2(habiles_disfrutados);
  const pagos = redondear2(habiles_pagos);
  const disponibles = diasDisponiblesParaToma(req.params.id, tomaIdExcluir);
  const solicitados = redondear2(disfrutados + pagos);
  if (solicitados > disponibles) {
    res.status(400).json({
      error: `Hábiles disfrutados + hábiles pagos (${solicitados}) supera los días pendientes disponibles (${disponibles})`,
    });
    return null;
  }

  return {
    fecha_inicio,
    fecha_fin,
    habiles_disfrutados: disfrutados,
    habiles_pagos: pagos,
    total_dias_disfrutados: redondear2(total_dias_disfrutados),
    compensacion_dinero: redondear2(compensacion_dinero),
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

// --- Suspensiones de contrato y licencias no remuneradas ---
// Sus días corren la fecha fin del periodo día por día, así que deben ser enteros.
function validarRangoConDias(req, res) {
  const { fecha_inicio, fecha_fin, dias } = req.body;
  if (!fechaFinValida(fecha_inicio, fecha_fin)) {
    res.status(400).json({ error: 'La fecha fin no puede ser anterior a la fecha inicio' });
    return null;
  }
  if (!esNumeroPositivo(dias) || !Number.isInteger(Number(dias))) {
    res.status(400).json({ error: 'Los días deben ser un número entero positivo' });
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