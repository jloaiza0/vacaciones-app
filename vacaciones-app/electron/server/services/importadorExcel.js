const xlsx = require('xlsx');
const { obtenerConexion } = require('../db/connection');
const { recalcularPeriodo } = require('./calculoVacaciones');

// Mapeo de estados ajustado a los 4 estados actuales (Sin vencer/Pendiente/Disfrutado/Anticipadas).
// "Pagado" ya no existe como estado: esas filas quedan en Pendiente para que se revisen a mano.
const MAPEO_ESTADO = [
  { patron: /pdte|pdt\b/i, estado: 'Pendiente' },
  { patron: /anticipad/i, estado: 'Anticipadas' },
];

function normalizarTexto(v) {
  return (v ?? '').toString().trim();
}

function parsearFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = normalizarTexto(valor);
  const m = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let [, d, mes, a] = m;
  if (a.length === 2) a = `20${a}`;
  const f = new Date(Number(a), Number(mes) - 1, Number(d));
  if (isNaN(f.getTime())) return null;
  return f.toISOString().slice(0, 10);
}

// 'PERIODO DE PAGO' viene como texto tipo '02/12/2024 -02/12/2025': se buscan
// las dos fechas completas en el texto en vez de partir por '-' (rompe con las fechas mismas)
function parsearRangoPeriodo(valor) {
  const texto = normalizarTexto(valor);
  const fechas = [...texto.matchAll(/\d{1,2}\/\d{1,2}\/\d{2,4}/g)].map((m) => m[0]);
  if (fechas.length === 2) return [parsearFecha(fechas[0]), parsearFecha(fechas[1])];
  const unica = parsearFecha(valor);
  return unica ? [unica, null] : [null, null];
}

function mapearEstado(comentarioOriginal) {
  const texto = normalizarTexto(comentarioOriginal);
  for (const { patron, estado } of MAPEO_ESTADO) {
    if (patron.test(texto)) {
      return { estado, comentario: texto, revisar: false };
    }
  }
  return { estado: 'Pendiente', comentario: texto, revisar: texto.length > 0 };
}

function encontrarFilaEncabezados(datos) {
  for (let i = 0; i < datos.length; i++) {
    if ((datos[i] || []).some((c) => /^C[ÉE]DULA$/i.test(normalizarTexto(c)))) return i;
  }
  throw new Error('No se encontró la fila de encabezados (columna CÉDULA)');
}

function indiceColumna(encabezados, nombreBuscado) {
  return encabezados.findIndex((h) => normalizarTexto(h).toUpperCase().includes(nombreBuscado));
}

// Lee el Excel y devuelve los registros normalizados, sin tocar la base de datos todavía.
function parsearExcel(rutaArchivo) {
  const libro = xlsx.readFile(rutaArchivo);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const datos = xlsx.utils.sheet_to_json(hoja, { header: 1 });
  const filaEncabezados = encontrarFilaEncabezados(datos);
  const encabezados = datos[filaEncabezados].map(normalizarTexto);

  const col = {
    cedula: indiceColumna(encabezados, 'CÉDULA') !== -1 ? indiceColumna(encabezados, 'CÉDULA') : indiceColumna(encabezados, 'CEDULA'),
    nombre: indiceColumna(encabezados, 'NOMBRE'),
    fechaIngreso: indiceColumna(encabezados, 'FECHA INGRESO'),
    firmado: indiceColumna(encabezados, 'FIRMADO'),
    fechaLiquidacion: indiceColumna(encabezados, 'FECHA LIQUIDACION'),
    periodoPago: indiceColumna(encabezados, 'PERIODO DE PAGO'),
    salario: indiceColumna(encabezados, 'SALARIO'),
    comentario: indiceColumna(encabezados, 'COMENTARIO'),
    scInicio: indiceColumna(encabezados, 'SUSPENSION CONTRATO F-I'),
    scFin: indiceColumna(encabezados, 'SUSPENSION CONTRATO F-F'),
    totalSC: indiceColumna(encabezados, 'TOTAL SC'),
    lnrInicio: indiceColumna(encabezados, 'LNR') !== -1 ? encabezados.findIndex((h) => /LNR.*INICIO/i.test(h)) : -1,
    lnrFin: encabezados.findIndex((h) => /LNR.*FINAL/i.test(h)),
    totalLNR: indiceColumna(encabezados, 'TOTAL LNR'),
  };

  const registros = [];
  const filasRevisar = [];

  for (let i = filaEncabezados + 1; i < datos.length; i++) {
    const fila = datos[i];
    if (!fila || fila.every((c) => c === undefined || c === '')) continue;

    const cedula = normalizarTexto(fila[col.cedula]);
    if (!cedula) continue;

    const [periodoInicio, periodoFin] = parsearRangoPeriodo(fila[col.periodoPago]);
    const { estado, comentario, revisar } = mapearEstado(fila[col.comentario]);

    const fechaIngreso = parsearFecha(fila[col.fechaIngreso]);
    const hoy = new Date().toISOString().slice(0, 10);

    const registro = {
      cedula,
      nombre: normalizarTexto(fila[col.nombre]),
      fechaIngreso: fechaIngreso && fechaIngreso <= hoy ? fechaIngreso : null,
      firmado: normalizarTexto(fila[col.firmado]),
      salario: Number(fila[col.salario]) || null,
      periodoInicio,
      periodoFin,
      fechaLiquidacion: parsearFecha(fila[col.fechaLiquidacion]),
      estado,
      comentario,
      scInicio: parsearFecha(fila[col.scInicio]),
      scFin: parsearFecha(fila[col.scFin]),
      totalSC: Number(fila[col.totalSC]) || 0,
      lnrInicio: parsearFecha(fila[col.lnrInicio]),
      lnrFin: parsearFecha(fila[col.lnrFin]),
      totalLNR: Number(fila[col.totalLNR]) || 0,
      filaExcel: i + 1,
    };

    if (!periodoInicio || !periodoFin || !registro.fechaIngreso || revisar) {
      filasRevisar.push({
        fila: registro.filaExcel,
        motivo: !periodoInicio || !periodoFin
          ? 'Fechas de periodo no reconocidas'
          : !registro.fechaIngreso
          ? 'Fecha de ingreso no reconocida o posterior a hoy'
          : 'Estado sin mapeo claro',
      });
    }

    registros.push(registro);
  }

  return { registros, filasRevisar };
}

// Guarda los registros ya parseados. Todo o nada: si algo falla a mitad de camino, se revierte.
function importarRegistros(registros) {
  const db = obtenerConexion();
  const trabajadoresNuevos = new Set();
  const periodosCreadosIds = [];

  const transaccion = db.transaction((filas) => {
    for (const r of filas) {
      if (!r.periodoInicio || !r.periodoFin || !r.fechaIngreso) continue; // quedan para revisión manual

      let trabajador = db.prepare('SELECT id FROM trabajadores WHERE cedula = ?').get(r.cedula);
      if (!trabajador) {
        const info = db
          .prepare(
            `INSERT INTO trabajadores (cedula, nombre, fecha_ingreso, firmado, salario)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(r.cedula, r.nombre, r.fechaIngreso, r.firmado, r.salario);
        trabajador = { id: info.lastInsertRowid };
        trabajadoresNuevos.add(r.cedula);
      }

      const infoPeriodo = db
        .prepare(
          `INSERT INTO periodos_vacaciones
             (trabajador_id, periodo_pago_inicio, periodo_pago_fin, periodo_pago_fin_base, fecha_liquidacion, estado, comentario)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(trabajador.id, r.periodoInicio, r.periodoFin, r.periodoFin, r.fechaLiquidacion, r.estado, r.comentario);
      const periodoId = infoPeriodo.lastInsertRowid;
      periodosCreadosIds.push(periodoId);

      if (r.scInicio && r.scFin) {
        db.prepare(
          'INSERT INTO suspensiones_contrato (periodo_id, fecha_inicio, fecha_fin, dias) VALUES (?, ?, ?, ?)'
        ).run(periodoId, r.scInicio, r.scFin, r.totalSC);
      }
      if (r.lnrInicio && r.lnrFin) {
        db.prepare(
          'INSERT INTO licencias_no_remuneradas (periodo_id, fecha_inicio, fecha_fin, dias) VALUES (?, ?, ?, ?)'
        ).run(periodoId, r.lnrInicio, r.lnrFin, r.totalLNR);
      }
    }
  });

  transaccion(registros);
  // Recalcula cada periodo creado para que periodo_pago_fin ya quede corrido con el SC/LNR importado
  periodosCreadosIds.forEach(recalcularPeriodo);

  return { trabajadoresNuevos: trabajadoresNuevos.size, periodosCreados: periodosCreadosIds.length };
}

module.exports = { parsearExcel, importarRegistros };