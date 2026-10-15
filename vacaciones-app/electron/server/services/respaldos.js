const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { obtenerConexion } = require('../db/connection');
const { hoyLocalISO } = require('./calculoVacaciones');

const CONSERVAR_DIARIOS = 30; // copias diarias que se guardan en cada carpeta
const CONSERVAR_MANUALES = 10; // copias hechas con "Respaldar ahora"
const HORAS_PARA_CONSIDERAR_ATRASADO = 48;

// Los patrones son estrictos a propósito: al limpiar copias viejas solo se borran
// archivos con estos nombres exactos, nunca otros archivos que haya en la carpeta.
const PATRON_DIARIO = /^vacaciones-\d{4}-\d{2}-\d{2}\.db$/;
const PATRON_MANUAL = /^vacaciones-\d{4}-\d{2}-\d{2}_\d{4}-manual\.db$/;

// Último error de cada destino (en memoria; se limpia al lograr un respaldo)
const ultimoError = { local: null, externa: null };

// Carpeta donde vive la base de datos (se toma de la propia conexión, así sigue
// funcionando si algún día se cambia de lugar)
function carpetaData() {
  return path.dirname(obtenerConexion().name);
}

// data/config.json: ahí se escribe la carpeta externa opcional (disco externo,
// carpeta sincronizada, etc.). Se crea sola, vacía, la primera vez.
function leerConfig() {
  const ruta = path.join(carpetaData(), 'config.json');
  try {
    if (!fs.existsSync(ruta)) {
      fs.writeFileSync(ruta, JSON.stringify({ carpetaRespaldoExterna: '' }, null, 2) + '\n');
      return { carpetaRespaldoExterna: '' };
    }
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch (err) {
    console.error(`No se pudo leer ${ruta}: ${err.message}`);
    return {};
  }
}

function destinos() {
  const local = path.join(carpetaData(), 'respaldos');
  const lista = [{ clave: 'local', carpeta: local }];
  const configurada = String(leerConfig().carpetaRespaldoExterna || '').trim();
  if (configurada) {
    const externa = path.resolve(configurada);
    if (externa !== path.resolve(local)) lista.push({ clave: 'externa', carpeta: externa });
  }
  return lista;
}

function hhmm(fecha) {
  return String(fecha.getHours()).padStart(2, '0') + String(fecha.getMinutes()).padStart(2, '0');
}

// Abre la copia y comprueba que SQLite la dé por sana. Un respaldo sin verificar
// puede descubrirse dañado justo cuando hace falta.
function verificar(ruta) {
  const copia = new Database(ruta, { readonly: true, fileMustExist: true });
  try {
    const resultado = copia.pragma('quick_check', { simple: true });
    if (resultado !== 'ok') throw new Error(`la copia no pasó la verificación (${resultado})`);
  } finally {
    copia.close();
  }
}

// Copia consistente de la base aunque la app esté escribiendo en ese momento
// (API de respaldo de SQLite). Se escribe a un archivo temporal y solo se renombra
// cuando ya está verificado, así nunca queda una copia a medias con nombre válido.
async function copiarA(db, carpeta, nombre) {
  fs.mkdirSync(carpeta, { recursive: true });
  const destino = path.join(carpeta, nombre);
  const temporal = `${destino}.tmp`;
  fs.rmSync(temporal, { force: true });
  try {
    await db.backup(temporal);
    verificar(temporal);
    fs.renameSync(temporal, destino);
  } catch (err) {
    fs.rmSync(temporal, { force: true });
    throw err;
  }
  return destino;
}

// Borra las copias más viejas, dejando solo las `conservar` más recientes.
// Los nombres llevan la fecha, así que ordenar por nombre = ordenar por antigüedad.
function rotar(carpeta, patron, conservar) {
  const archivos = fs.readdirSync(carpeta).filter((n) => patron.test(n)).sort();
  for (const nombre of archivos.slice(0, Math.max(archivos.length - conservar, 0))) {
    fs.rmSync(path.join(carpeta, nombre), { force: true });
  }
}

async function respaldarEn(destino, nombre, tipo) {
  const db = obtenerConexion();
  try {
    const archivo = await copiarA(db, destino.carpeta, nombre);
    try {
      rotar(
        destino.carpeta,
        tipo === 'manual' ? PATRON_MANUAL : PATRON_DIARIO,
        tipo === 'manual' ? CONSERVAR_MANUALES : CONSERVAR_DIARIOS
      );
    } catch (err) {
      console.error(`No se pudieron limpiar copias viejas en ${destino.carpeta}: ${err.message}`);
    }
    ultimoError[destino.clave] = null;
    console.log(`Respaldo ${tipo} (${destino.clave}): ${archivo}`);
    return { ok: true, archivo };
  } catch (err) {
    ultimoError[destino.clave] = err.message;
    console.error(`Respaldo ${tipo} (${destino.clave}) falló: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// Los respaldos se hacen de a uno: si llegan dos pedidos a la vez, el segundo espera.
let cola = Promise.resolve();
function enCola(trabajo) {
  const resultado = cola.then(trabajo);
  cola = resultado.catch(() => {});
  return resultado;
}

// Una copia por día en cada carpeta. Si ya existe la de hoy no hace nada; si en alguna
// carpeta falta (por ejemplo, el disco externo estaba desconectado), la crea en la
// siguiente revisión.
function asegurarRespaldoDiario() {
  return enCola(async () => {
    const nombre = `vacaciones-${hoyLocalISO()}.db`;
    for (const destino of destinos()) {
      if (fs.existsSync(path.join(destino.carpeta, nombre))) continue;
      await respaldarEn(destino, nombre, 'diario');
    }
  });
}

// "Respaldar ahora": copia nueva con la hora en el nombre, para no pisar la del día.
function crearRespaldoManual() {
  return enCola(async () => {
    const nombre = `vacaciones-${hoyLocalISO()}_${hhmm(new Date())}-manual.db`;
    const resultado = { local: null, externa: { configurada: false } };
    for (const destino of destinos()) {
      const r = await respaldarEn(destino, nombre, 'manual');
      if (destino.clave === 'local') resultado.local = r;
      else resultado.externa = { configurada: true, ...r };
    }
    return resultado;
  });
}

function momentoUltimaCopia(carpeta) {
  try {
    let masReciente = null;
    for (const nombre of fs.readdirSync(carpeta)) {
      if (!PATRON_DIARIO.test(nombre) && !PATRON_MANUAL.test(nombre)) continue;
      const t = fs.statSync(path.join(carpeta, nombre)).mtimeMs;
      if (masReciente === null || t > masReciente) masReciente = t;
    }
    return masReciente === null ? null : new Date(masReciente).toISOString();
  } catch {
    return null; // carpeta inexistente o disco desconectado
  }
}

function estadoRespaldos() {
  const limite = HORAS_PARA_CONSIDERAR_ATRASADO * 60 * 60 * 1000;
  const resumen = (destino) => {
    const ultimo = momentoUltimaCopia(destino.carpeta);
    return {
      ultimoRespaldo: ultimo,
      atrasado: !ultimo || Date.now() - new Date(ultimo).getTime() > limite,
      error: ultimoError[destino.clave],
    };
  };
  const [local, externa] = destinos();
  return {
    local: resumen(local),
    externa: externa ? { configurada: true, ...resumen(externa) } : { configurada: false },
  };
}

module.exports = { asegurarRespaldoDiario, crearRespaldoManual, estadoRespaldos };