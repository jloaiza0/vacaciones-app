-- Schema de la base de datos - Gestión de vacaciones
-- SQLite. Se corre una sola vez al crear data/vacaciones.db
-- Importante: activar en cada conexión -> PRAGMA foreign_keys = ON;

CREATE TABLE trabajadores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cedula          TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  fecha_ingreso   TEXT NOT NULL,               -- 'YYYY-MM-DD', no puede ser futura
  firmado         TEXT,                        -- 'Si' / 'No'
  salario         REAL,
  activo          INTEGER NOT NULL DEFAULT 1,  -- 1 = activo, 0 = inactivo (soft delete)
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE periodos_vacaciones (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  trabajador_id           INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
  periodo_pago_inicio     TEXT NOT NULL,       -- fecha de causación
  periodo_pago_fin        TEXT NOT NULL,       -- visible: causación + 1 año, YA corrido con SC+LNR
  periodo_pago_fin_base   TEXT NOT NULL,       -- interno: causación + 1 año SIN correr (para recalcular sin arrastrar error)
  fecha_liquidacion       TEXT,
  estado                  TEXT NOT NULL DEFAULT 'Sin vencer'
                          CHECK (estado IN ('Sin vencer','Pendiente','Disfrutado','Anticipadas')),
  comentario              TEXT,
  total_dias_disfrutados  INTEGER NOT NULL DEFAULT 0,  -- informativo, suma de tomas
  habiles_disfrutados     INTEGER NOT NULL DEFAULT 0,  -- calculado, suma de tomas
  dias_pendientes         INTEGER NOT NULL DEFAULT 15, -- 15 al generarse, baja con cada toma
  creado_en               TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tomas_vacaciones (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_id              INTEGER NOT NULL REFERENCES periodos_vacaciones(id) ON DELETE CASCADE,
  fecha_inicio            TEXT NOT NULL,
  fecha_fin               TEXT NOT NULL,
  habiles_disfrutados     INTEGER NOT NULL DEFAULT 0,  -- resta de días pendientes
  habiles_pagos           INTEGER NOT NULL DEFAULT 0,  -- resta de días pendientes
  total_dias_disfrutados  INTEGER NOT NULL DEFAULT 0,  -- informativo, no afecta cálculos
  compensacion_dinero     REAL NOT NULL DEFAULT 0,     -- salario/30 * habiles_pagos, editable
  comentario              TEXT
);

CREATE TABLE suspensiones_contrato (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_id  INTEGER NOT NULL REFERENCES periodos_vacaciones(id) ON DELETE CASCADE,
  fecha_inicio TEXT NOT NULL,
  fecha_fin    TEXT NOT NULL,
  dias         INTEGER NOT NULL,
  comentario   TEXT
);

CREATE TABLE licencias_no_remuneradas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_id  INTEGER NOT NULL REFERENCES periodos_vacaciones(id) ON DELETE CASCADE,
  fecha_inicio TEXT NOT NULL,
  fecha_fin    TEXT NOT NULL,
  dias         INTEGER NOT NULL,
  comentario   TEXT
);

-- Festivos oficiales (calculados por código) + días adicionales que agregue el usuario
CREATE TABLE dias_no_laborales (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  origen      TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('festivo','manual'))
);

-- Una sola fila: credencial única de acceso a la app editora
CREATE TABLE usuario_admin (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  usuario       TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE INDEX idx_periodos_trabajador   ON periodos_vacaciones(trabajador_id);
CREATE INDEX idx_tomas_periodo         ON tomas_vacaciones(periodo_id);
CREATE INDEX idx_sc_periodo            ON suspensiones_contrato(periodo_id);
CREATE INDEX idx_lnr_periodo           ON licencias_no_remuneradas(periodo_id);