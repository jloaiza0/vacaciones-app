// Importa trabajadores y periodos de vacaciones desde el Excel de la empresa
// (hoja "VACACIONES VIGENTES": CEDULA | Nombre Empleado | Fecha de Ingreso | Periodo inicio | Periodo fin).
//
// Uso (desde la carpeta del proyecto, con la app CERRADA):
//   node electron/server/scripts/importarExcel.js "C:\ruta\PERIODOS_VACACIONES_PERSONAL_RCA.xlsx"
//       -> SIMULACRO: calcula todo y muestra el reporte, pero no guarda nada.
//   node electron/server/scripts/importarExcel.js "C:\ruta\PERIODOS_VACACIONES_PERSONAL_RCA.xlsx" --aplicar
//       -> Guarda de verdad (antes hace una copia de la base en data/respaldos).
//
// Reglas:
// - Del Excel solo se toma el INICIO de cada periodo. El fin lo pone la app con el año completo
//   (inicio + 365 días, igual que cuando creas un periodo a mano) y el estado (Pendiente / Sin vencer)
//   también lo calcula la app (generarPeriodo + recalcularPeriodo). Así no quedan periodos de más de un año.
// - El fin que traiga el Excel se ignora. Si ese fin estaba a más de 366 días del inicio (corrido por
//   suspensiones o licencias), el reporte lo avisa para que registres la SC/LNR en la app si aplica.
// - Un trabajador cuya cédula ya existe en la base NO se toca (ni sus periodos): se omite y se informa.
// - El Excel no trae salario, firmado, tomas, suspensiones ni licencias: el trabajador queda con
//   firmado = "No" y sin salario, y esos datos se cargan después desde la app.
// - Si la cadena de periodos de un trabajador está dañada (fechas que no encadenan, un fin anterior
//   al inicio, saltos de años), y el primer periodo coincide con la fecha de ingreso, se reconstruyen
//   los inicios como aniversarios de la fecha de ingreso. Todo cambio de este tipo queda en el reporte.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { obtenerConexion } = require('../db/connection');
const {
  generarPeriodo,
  recalcularPeriodo,
  sumarDias,
  hoyLocalISO,
  DIAS_CICLO,
} = require('../services/calculoVacaciones');
const { normalizarCedula, fechaISOValida } = require('../utils/texto');

const TOLERANCIA_ENLACE_DIAS = 5; // cuánto puede separarse el inicio de un periodo del fin del anterior
const DURACION_NORMAL_MAX = 366; // más que esto = incoherencia (366 = año con 29 de febrero)
const DURACION_MIN = 330; // un periodo dura ~1 año...
const DURACION_MAX = 900; // ...más lo que lo corran las SC/LNR (hay casos reales de ~5 meses de corrimiento)

// ---------- Fechas ----------

function serialAISO(n) {
  // Número de serie de Excel -> 'YYYY-MM-DD' (sin zonas horarias de por medio)
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function aFechaISO(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return serialAISO(valor);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();
  if (fechaISOValida(texto)) return texto;
  const m = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/aaaa
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return fechaISOValida(iso) ? iso : null;
  }
  return null;
}

function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function sumarAnios(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(y + n, m - 1, d));
  if (f.getUTCMonth() !== m - 1) f.setUTCDate(0); // 29 de febrero en año no bisiesto -> 28
  return f.toISOString().slice(0, 10);
}

// ---------- Lectura del Excel ----------

function leerExcel(ruta) {
  const libro = XLSX.readFile(ruta);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  // Las celdas combinadas (cédula, nombre e ingreso se combinan sobre todas las filas de un
  // trabajador) solo traen valor en la primera fila: ahí empieza cada trabajador.
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });

  const encabezado = String(filas[0]?.[0] ?? '').toUpperCase();
  if (!encabezado.includes('CEDULA')) {
    throw new Error(`La celda A1 debería decir CEDULA y dice "${filas[0]?.[0] ?? ''}". ¿Es el archivo correcto?`);
  }

  const trabajadores = [];
  let actual = null;
  for (let i = 1; i < filas.length; i++) {
    const [ced, nom, ing, ini, fin] = filas[i];
    const numeroFila = i + 1;

    if (ced !== null || nom !== null) {
      actual = {
        fila: numeroFila,
        cedula: normalizarCedula(ced),
        nombre: String(nom ?? '').trim().replace(/\s+/g, ' '),
        ingreso: aFechaISO(ing),
        ingresoOriginal: ing,
        periodos: [],
        errores: [],
        avisos: [],
      };
      trabajadores.push(actual);
    }

    if (ini === null && fin === null) continue; // fila sin periodo (p. ej. filas vacías al final)
    if (!actual) continue;

    const inicio = aFechaISO(ini);
    const finExcel = aFechaISO(fin);
    if (!inicio) {
      actual.errores.push(`Fila ${numeroFila}: la fecha de inicio del periodo no es válida (${ini})`);
      continue;
    }
    if (fin !== null && !finExcel) {
      actual.errores.push(`Fila ${numeroFila}: la fecha de fin del periodo no es válida (${fin})`);
      continue;
    }
    actual.periodos.push({ fila: numeroFila, inicio, finExcel });
  }
  return trabajadores;
}

// ---------- Validación de la cadena de periodos ----------

function cadenaValida(periodos) {
  for (let i = 0; i < periodos.length; i++) {
    const p = periodos[i];
    if (p.finExcel) {
      const duracion = diasEntre(p.inicio, p.finExcel);
      if (duracion < DURACION_MIN || duracion > DURACION_MAX) return false;
    }
    if (i > 0) {
      const anterior = periodos[i - 1];
      const referencia = anterior.finExcel || sumarDias(anterior.inicio, DIAS_CICLO);
      if (Math.abs(diasEntre(referencia, p.inicio)) > TOLERANCIA_ENLACE_DIAS) return false;
    }
  }
  return true;
}

function prepararTrabajador(t) {
  if (!t.cedula) t.errores.push(`Fila ${t.fila}: falta la cédula`);
  if (!t.nombre) t.errores.push(`Fila ${t.fila}: falta el nombre`);
  if (!t.ingreso) t.errores.push(`Fila ${t.fila}: la fecha de ingreso no es válida (${t.ingresoOriginal})`);
  else if (t.ingreso > hoyLocalISO()) t.errores.push(`Fila ${t.fila}: la fecha de ingreso es posterior a hoy (${t.ingreso})`);
  if (t.errores.length) return;

  if (t.periodos.length && !cadenaValida(t.periodos)) {
    if (t.periodos[0].inicio === t.ingreso) {
      const originales = t.periodos.map((p) => `${p.inicio}→${p.finExcel ?? '?'}`).join(', ');
      t.periodos = t.periodos.map((p, k) => ({
        fila: p.fila,
        inicio: sumarAnios(t.ingreso, k),
        finExcel: null,
        reparado: true,
      }));
      t.avisos.push(
        `Las fechas de sus ${t.periodos.length} periodos (filas ${t.periodos[0].fila}-${t.periodos[t.periodos.length - 1].fila}) ` +
          `no encadenaban en el Excel. Se reconstruyeron como aniversarios de la fecha de ingreso (${t.ingreso}). ` +
          `Valores originales: ${originales}`
      );
    } else {
      t.errores.push(
        `Las fechas de sus periodos no encadenan y el primer periodo (${t.periodos[0].inicio}) no coincide con la fecha de ingreso (${t.ingreso}): revísalas en el Excel. Se importa el trabajador SIN periodos.`
      );
      t.periodos = [];
    }
  }

  if (t.periodos.length && t.periodos[0].inicio !== t.ingreso && !t.periodos[0].reparado) {
    t.avisos.push(`El primer periodo empieza el ${t.periodos[0].inicio}, distinto de la fecha de ingreso (${t.ingreso})`);
  }
}

// ---------- Importación ----------

class Revertir extends Error {}

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes('--aplicar');
  const ruta = args.find((a) => !a.startsWith('--'));
  if (!ruta) {
    console.error('Falta la ruta del Excel. Ejemplo:\n  node electron/server/scripts/importarExcel.js "C:\\ruta\\archivo.xlsx" [--aplicar]');
    process.exit(1);
  }
  if (!fs.existsSync(ruta)) {
    console.error(`No encuentro el archivo: ${ruta}`);
    process.exit(1);
  }

  const trabajadores = leerExcel(ruta);
  trabajadores.forEach(prepararTrabajador);

  const db = obtenerConexion();

  // Copia de seguridad de la base ANTES de escribir (solo al aplicar)
  if (aplicar) {
    const carpeta = path.join(path.dirname(db.name), 'respaldos');
    fs.mkdirSync(carpeta, { recursive: true });
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const sello = `${hoyLocalISO()}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}${pad(ahora.getSeconds())}`;
    const destino = path.join(carpeta, `vacaciones-${sello}-antes-de-importar.db`);
    await db.backup(destino);
    console.log(`Copia de seguridad creada: ${destino}\n`);
  }

  const reporte = {
    importados: 0,
    periodos: 0,
    yaExistian: [],
    sinImportar: [],
    avisos: [],
    incoherencias: [],
    futuros: [],
    estados: {},
  };

  const insertarTrabajador = db.prepare(
    `INSERT INTO trabajadores (cedula, nombre, fecha_ingreso, firmado, salario) VALUES (?, ?, ?, 'No', NULL)`
  );
  const buscarPorCedula = db.prepare('SELECT id, nombre FROM trabajadores WHERE cedula = ?');
  const cedulasVistas = new Set();

  const ejecutar = db.transaction(() => {
    for (const t of trabajadores) {
      const etiqueta = `${t.nombre || '(sin nombre)'} [cédula ${t.cedula || '?'}]`;

      // Errores graves que impiden importar al trabajador (datos básicos inválidos)
      const sinDatosBasicos = !t.cedula || !t.nombre || !t.ingreso || t.ingreso > hoyLocalISO();
      if (sinDatosBasicos) {
        reporte.sinImportar.push(`${etiqueta}: ${t.errores.join('; ')}`);
        continue;
      }
      if (cedulasVistas.has(t.cedula)) {
        reporte.sinImportar.push(`${etiqueta}: la cédula está repetida dentro del Excel (fila ${t.fila}); se omite esta aparición`);
        continue;
      }
      cedulasVistas.add(t.cedula);

      const existente = buscarPorCedula.get(t.cedula);
      if (existente) {
        reporte.yaExistian.push(`${etiqueta} ya existe en la base como "${existente.nombre}"; no se toca`);
        continue;
      }

      const trabajadorId = insertarTrabajador.run(t.cedula, t.nombre, t.ingreso).lastInsertRowid;
      reporte.importados++;
      for (const e of t.errores) reporte.avisos.push(`${etiqueta}: ${e}`);
      for (const a of t.avisos) reporte.avisos.push(`${etiqueta}: ${a}`);

      for (const p of t.periodos) {
        const periodoId = generarPeriodo(trabajadorId, p.inicio);
        const creado = recalcularPeriodo(periodoId);
        reporte.periodos++;
        reporte.estados[creado.estado] = (reporte.estados[creado.estado] || 0) + 1;

        if (p.inicio > hoyLocalISO()) reporte.futuros.push(`${etiqueta}: periodo que empieza el ${p.inicio} (aún no ha empezado)`);
        if (p.finExcel) {
          const dias = diasEntre(p.inicio, p.finExcel);
          if (dias > DURACION_NORMAL_MAX) {
            reporte.incoherencias.push(
              `${t.nombre} [cédula ${t.cedula}] (fila ${p.fila}): inicio ${p.inicio}, el Excel traía fin ${p.finExcel} = ${dias} días (${dias - 365} más que un año); la app deja el año completo`
            );
          }
        }
      }
    }
    if (!aplicar) throw new Revertir(); // simulacro: se deshace todo
  });

  try {
    ejecutar();
  } catch (err) {
    if (!(err instanceof Revertir)) throw err;
  }

  // ---------- Reporte ----------
  const linea = '─'.repeat(70);
  console.log(linea);
  console.log(aplicar ? 'IMPORTACIÓN APLICADA' : 'SIMULACRO (no se guardó nada)');
  console.log(linea);
  console.log(`Filas de trabajadores leídas en el Excel: ${trabajadores.length}`);
  console.log(`Trabajadores ${aplicar ? 'importados' : 'que se importarían'}: ${reporte.importados}`);
  console.log(`Periodos ${aplicar ? 'creados' : 'que se crearían'}: ${reporte.periodos}`);
  console.log(`Estados resultantes: ${JSON.stringify(reporte.estados)}`);

  const seccion = (titulo, lista) => {
    if (!lista.length) return;
    console.log(`\n${titulo} (${lista.length}):`);
    for (const x of lista) console.log(`  - ${x}`);
  };
  seccion('NO IMPORTADOS por datos inválidos o repetidos', reporte.sinImportar);
  seccion('YA EXISTÍAN en la base (omitidos)', reporte.yaExistian);
  seccion('AVISOS para revisar', reporte.avisos);
  seccion('Periodos cuyo fin en el Excel pasaba de 366 días (se ignoró ese fin; queda el año completo)', reporte.incoherencias);
  seccion('Periodos que empiezan en el futuro', reporte.futuros);

  if (!aplicar) {
    console.log(`\nSi el reporte está bien, repite el comando agregando --aplicar al final.`);
  } else {
    console.log('\nListo. Abre la app y revisa unos cuantos trabajadores contra el Excel.');
  }
}

main().catch((err) => {
  console.error('\nERROR: la importación falló y no se guardó nada.');
  console.error(err.stack || err.message);
  process.exit(1);
});