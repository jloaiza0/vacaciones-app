const { obtenerConexion } = require('../db/connection');

const DIAS_GENERADOS_POR_CICLO = 15;
const DIAS_CICLO = 365;

function sumarDias(fechaISO, dias) {
  const f = new Date(fechaISO);
  f.setDate(f.getDate() + dias);
  return f.toISOString().slice(0, 10);
}

// Crea un periodo nuevo: 15 días, estado inicial "Sin vencer"
function generarPeriodo(trabajadorId, fechaCausacion) {
  const db = obtenerConexion();
  const fin = sumarDias(fechaCausacion, DIAS_CICLO);
  const info = db
    .prepare(
      `INSERT INTO periodos_vacaciones
        (trabajador_id, periodo_pago_inicio, periodo_pago_fin, periodo_pago_fin_base, dias_pendientes, estado)
       VALUES (?, ?, ?, ?, ?, 'Sin vencer')`
    )
    .run(trabajadorId, fechaCausacion, fin, fin, DIAS_GENERADOS_POR_CICLO);
  return info.lastInsertRowid;
}

// Recalcula todo lo derivado de un periodo: totales, periodo_pago_fin corrido y estado.
// Se llama después de cualquier cambio en tomas, SC o LNR de ese periodo.
function recalcularPeriodo(periodoId) {
  const db = obtenerConexion();
  const periodo = db.prepare('SELECT * FROM periodos_vacaciones WHERE id = ?').get(periodoId);
  if (!periodo) throw new Error('Periodo no encontrado');

  const tomas = db.prepare('SELECT * FROM tomas_vacaciones WHERE periodo_id = ?').all(periodoId);
  const suspensiones = db.prepare('SELECT * FROM suspensiones_contrato WHERE periodo_id = ?').all(periodoId);
  const licencias = db.prepare('SELECT * FROM licencias_no_remuneradas WHERE periodo_id = ?').all(periodoId);

  const habilesDisfrutados = tomas.reduce((acc, t) => acc + t.habiles_disfrutados, 0);
  const habilesPagos = tomas.reduce((acc, t) => acc + t.habiles_pagos, 0);
  const totalDiasDisfrutados = tomas.reduce((acc, t) => acc + t.total_dias_disfrutados, 0);
  const totalSC = suspensiones.reduce((acc, s) => acc + s.dias, 0);
  const totalLNR = licencias.reduce((acc, l) => acc + l.dias, 0);

  const diasPendientes = Math.max(DIAS_GENERADOS_POR_CICLO - (habilesDisfrutados + habilesPagos), 0);
  // periodo_pago_fin se corre directo desde la base, sin arrastrar corridas anteriores
  const periodoPagoFin = sumarDias(periodo.periodo_pago_fin_base, totalSC + totalLNR);

  let estado = periodo.estado;
  if (estado === 'Anticipadas') {
    // Protegido: solo se mueve solo cuando se termina de disfrutar del todo
    if (diasPendientes === 0) estado = 'Disfrutado';
  } else {
    const hoy = new Date().toISOString().slice(0, 10);
    if (diasPendientes === 0) estado = 'Disfrutado';
    else if (hoy > periodoPagoFin) estado = 'Pendiente';
    else estado = 'Sin vencer';
  }

  db.prepare(
    `UPDATE periodos_vacaciones SET
       total_dias_disfrutados = ?, habiles_disfrutados = ?, dias_pendientes = ?,
       periodo_pago_fin = ?, estado = ?, actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(totalDiasDisfrutados, habilesDisfrutados, diasPendientes, periodoPagoFin, estado, periodoId);

  return db.prepare('SELECT * FROM periodos_vacaciones WHERE id = ?').get(periodoId);
}

// Días pendientes disponibles para una toma nueva o editada, sin contar la toma que se está editando
function diasDisponiblesParaToma(periodoId, tomaIdExcluir) {
  const db = obtenerConexion();
  const periodo = db.prepare('SELECT dias_pendientes FROM periodos_vacaciones WHERE id = ?').get(periodoId);
  if (!periodo) throw new Error('Periodo no encontrado');
  if (!tomaIdExcluir) return periodo.dias_pendientes;

  const tomaVieja = db
    .prepare('SELECT habiles_disfrutados, habiles_pagos FROM tomas_vacaciones WHERE id = ?')
    .get(tomaIdExcluir);
  const restaba = tomaVieja ? tomaVieja.habiles_disfrutados + tomaVieja.habiles_pagos : 0;
  return periodo.dias_pendientes + restaba;
}

module.exports = {
  generarPeriodo,
  recalcularPeriodo,
  diasDisponiblesParaToma,
  sumarDias,
  DIAS_GENERADOS_POR_CICLO,
};