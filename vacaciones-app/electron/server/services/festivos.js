// Festivos de Colombia calculados por código (sin lista fija que mantener a mano)
// + días adicionales que el usuario agregue a mano en la tabla dias_no_laborales.

function fecha(anio, mes, dia) {
  return new Date(anio, mes - 1, dia);
}

function sumarDias(f, dias) {
  const copia = new Date(f);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function formatearISO(f) {
  return f.toISOString().slice(0, 10);
}

// Algoritmo de Meeus/Jones/Butcher para el Domingo de Pascua
function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fecha(anio, mes, dia);
}

// Ley Emiliani: si el festivo no cae en lunes, se traslada al lunes siguiente
function moverALunesSiguiente(f) {
  const diaSemana = f.getDay(); // 0 = domingo, 1 = lunes
  if (diaSemana === 1) return f;
  const diasHastaLunes = diaSemana === 0 ? 1 : 8 - diaSemana;
  return sumarDias(f, diasHastaLunes);
}

function obtenerFestivos(anio) {
  const pascua = calcularPascua(anio);

  const fijos = [
    fecha(anio, 1, 1),   // Año Nuevo
    fecha(anio, 5, 1),   // Día del Trabajo
    fecha(anio, 7, 20),  // Independencia
    fecha(anio, 8, 7),   // Batalla de Boyacá
    fecha(anio, 12, 8),  // Inmaculada Concepción
    fecha(anio, 12, 25), // Navidad
  ];

  const trasladables = [
    fecha(anio, 1, 6),   // Reyes Magos
    fecha(anio, 3, 19),  // San José
    fecha(anio, 6, 29),  // San Pedro y San Pablo
    fecha(anio, 8, 15),  // Asunción de la Virgen
    fecha(anio, 10, 12), // Día de la Raza
    fecha(anio, 11, 1),  // Todos los Santos
    fecha(anio, 11, 11), // Independencia de Cartagena
  ].map(moverALunesSiguiente);

  const dependenPascua = [
    sumarDias(pascua, -3),                        // Jueves Santo (no se traslada)
    sumarDias(pascua, -2),                         // Viernes Santo (no se traslada)
    moverALunesSiguiente(sumarDias(pascua, 39)),   // Ascensión del Señor
    moverALunesSiguiente(sumarDias(pascua, 60)),   // Corpus Christi
    moverALunesSiguiente(sumarDias(pascua, 68)),   // Sagrado Corazón
  ];

  return [...fijos, ...trasladables, ...dependenPascua].map(formatearISO);
}

// Junta festivos calculados (para el rango de años que haga falta) + los manuales guardados en la BD
function construirSetDiasNoLaborales(db, anioInicio, anioFin) {
  const set = new Set();
  for (let a = anioInicio; a <= anioFin; a++) {
    obtenerFestivos(a).forEach((f) => set.add(f));
  }
  const manuales = db.prepare("SELECT fecha FROM dias_no_laborales WHERE origen = 'manual'").all();
  manuales.forEach((r) => set.add(r.fecha));
  return set;
}

function esDiaHabil(fechaISO, diasNoLaborales) {
  const f = new Date(fechaISO);
  const diaSemana = f.getDay();
  if (diaSemana === 0 || diaSemana === 6) return false; // fin de semana
  return !diasNoLaborales.has(fechaISO);
}

function contarDiasHabiles(fechaInicioISO, fechaFinISO, diasNoLaborales) {
  let cuenta = 0;
  let cursor = new Date(fechaInicioISO);
  const fin = new Date(fechaFinISO);
  while (cursor <= fin) {
    const iso = formatearISO(cursor);
    if (esDiaHabil(iso, diasNoLaborales)) cuenta++;
    cursor = sumarDias(cursor, 1);
  }
  return cuenta;
}

module.exports = {
  obtenerFestivos,
  construirSetDiasNoLaborales,
  esDiaHabil,
  contarDiasHabiles,
};
