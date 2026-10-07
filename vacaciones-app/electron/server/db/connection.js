const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let instancia = null;

// Singleton: toda la app comparte esta misma conexión al archivo .db
function obtenerConexion() {
  if (!instancia) {
    const carpetaData = path.join(__dirname, '../../../data');
    if (!fs.existsSync(carpetaData)) fs.mkdirSync(carpetaData, { recursive: true });

    const rutaDb = path.join(carpetaData, 'vacaciones.db');
    const esNueva = !fs.existsSync(rutaDb);

    instancia = new Database(rutaDb);
    instancia.pragma('foreign_keys = ON'); // sin esto la cascada NO funciona

    if (esNueva) {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      instancia.exec(schema);
      console.log('Base de datos creada en', rutaDb);
    }

    migrarComentarios(instancia);
    migrarEstructuraGrande(instancia);
  }
  return instancia;
}

function tieneColumna(db, tabla, columna) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);
}

// Migración antigua: agrega comentario a SC/LNR si faltara (bases muy viejas)
function migrarComentarios(db) {
  for (const tabla of ['tomas_vacaciones', 'suspensiones_contrato', 'licencias_no_remuneradas']) {
    if (!tieneColumna(db, tabla, 'comentario')) {
      db.exec(`ALTER TABLE ${tabla} ADD COLUMN comentario TEXT`);
      console.log(`Migración: agregada columna comentario a ${tabla}`);
    }
  }
}

// Migración grande: nuevos estados, se quita fecha_corrida/habiles_pagos/vacaciones_pagas de
// periodos, se quita contrato_otrosi de trabajadores, y tomas_vacaciones cambia "dias" por
// habiles_disfrutados/habiles_pagos/total_dias_disfrutados/compensacion_dinero.
// Se detecta si hace falta mirando si todavía existe la columna "fecha_corrida".
function migrarEstructuraGrande(db) {
  if (!tieneColumna(db, 'periodos_vacaciones', 'fecha_corrida')) return; // ya migrado

  console.log('Migración grande: actualizando estructura de periodos, trabajadores y tomas...');
  const hoy = new Date().toISOString().slice(0, 10);

  const correr = db.transaction(() => {
    // --- trabajadores: quitar contrato_otrosi ---
    db.exec(`
      CREATE TABLE trabajadores_nueva (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        cedula          TEXT NOT NULL UNIQUE,
        nombre          TEXT NOT NULL,
        fecha_ingreso   TEXT NOT NULL,
        firmado         TEXT,
        salario         REAL,
        activo          INTEGER NOT NULL DEFAULT 1,
        creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
        actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO trabajadores_nueva (id, cedula, nombre, fecha_ingreso, firmado, salario, activo, creado_en, actualizado_en)
      SELECT id, cedula, nombre, fecha_ingreso, firmado, salario, activo, creado_en, actualizado_en FROM trabajadores;
    `);
    db.exec('DROP TABLE trabajadores;');
    db.exec('ALTER TABLE trabajadores_nueva RENAME TO trabajadores;');

    // --- periodos_vacaciones: nuevos estados, sin fecha_corrida/habiles_pagos/vacaciones_pagas ---
    db.exec(`
      CREATE TABLE periodos_vacaciones_nueva (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        trabajador_id           INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
        periodo_pago_inicio     TEXT NOT NULL,
        periodo_pago_fin        TEXT NOT NULL,
        periodo_pago_fin_base   TEXT NOT NULL,
        fecha_liquidacion       TEXT,
        estado                  TEXT NOT NULL DEFAULT 'Sin vencer'
                                CHECK (estado IN ('Sin vencer','Pendiente','Disfrutado','Anticipadas')),
        comentario              TEXT,
        total_dias_disfrutados  INTEGER NOT NULL DEFAULT 0,
        habiles_disfrutados     INTEGER NOT NULL DEFAULT 0,
        dias_pendientes         INTEGER NOT NULL DEFAULT 15,
        creado_en               TEXT NOT NULL DEFAULT (datetime('now')),
        actualizado_en          TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const periodosViejos = db.prepare('SELECT * FROM periodos_vacaciones').all();
    const insertarPeriodo = db.prepare(`
      INSERT INTO periodos_vacaciones_nueva
        (id, trabajador_id, periodo_pago_inicio, periodo_pago_fin, periodo_pago_fin_base,
         fecha_liquidacion, estado, comentario, total_dias_disfrutados, habiles_disfrutados,
         dias_pendientes, creado_en, actualizado_en)
      VALUES (@id, @trabajador_id, @periodo_pago_inicio, @periodo_pago_fin, @periodo_pago_fin_base,
              @fecha_liquidacion, @estado, @comentario, @total_dias_disfrutados, @habiles_disfrutados,
              @dias_pendientes, @creado_en, @actualizado_en)
    `);

    for (const p of periodosViejos) {
      const finBase = p.periodo_pago_fin; // el que tenía antes de correrse era el "base"
      const finCorrido = p.fecha_corrida || p.periodo_pago_fin;
      let estado;
      if ((p.dias_pendientes ?? 15) <= 0) estado = 'Disfrutado';
      else if (hoy > finCorrido) estado = 'Pendiente';
      else estado = 'Sin vencer';

      insertarPeriodo.run({
        id: p.id,
        trabajador_id: p.trabajador_id,
        periodo_pago_inicio: p.periodo_pago_inicio,
        periodo_pago_fin: finCorrido,
        periodo_pago_fin_base: finBase,
        fecha_liquidacion: p.fecha_liquidacion,
        estado,
        comentario: p.comentario,
        total_dias_disfrutados: p.total_dias_disfrutados || 0,
        habiles_disfrutados: p.habiles_disfrutados || 0,
        dias_pendientes: p.dias_pendientes ?? 15,
        creado_en: p.creado_en,
        actualizado_en: p.actualizado_en,
      });
    }

    db.exec('DROP TABLE periodos_vacaciones;');
    db.exec('ALTER TABLE periodos_vacaciones_nueva RENAME TO periodos_vacaciones;');

    // --- tomas_vacaciones: "dias" se reparte en los campos nuevos ---
    db.exec(`
      CREATE TABLE tomas_vacaciones_nueva (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        periodo_id              INTEGER NOT NULL REFERENCES periodos_vacaciones(id) ON DELETE CASCADE,
        fecha_inicio            TEXT NOT NULL,
        fecha_fin               TEXT NOT NULL,
        habiles_disfrutados     INTEGER NOT NULL DEFAULT 0,
        habiles_pagos           INTEGER NOT NULL DEFAULT 0,
        total_dias_disfrutados  INTEGER NOT NULL DEFAULT 0,
        compensacion_dinero     REAL NOT NULL DEFAULT 0,
        comentario              TEXT
      );
    `);
    db.exec(`
      INSERT INTO tomas_vacaciones_nueva
        (id, periodo_id, fecha_inicio, fecha_fin, habiles_disfrutados, habiles_pagos, total_dias_disfrutados, compensacion_dinero, comentario)
      SELECT id, periodo_id, fecha_inicio, fecha_fin, dias, 0, dias, 0, comentario FROM tomas_vacaciones;
    `);
    db.exec('DROP TABLE tomas_vacaciones;');
    db.exec('ALTER TABLE tomas_vacaciones_nueva RENAME TO tomas_vacaciones;');

    db.exec('CREATE INDEX idx_periodos_trabajador ON periodos_vacaciones(trabajador_id);');
    db.exec('CREATE INDEX idx_tomas_periodo ON tomas_vacaciones(periodo_id);');
  });

  correr();
  console.log('Migración grande completada.');
}

module.exports = { obtenerConexion };