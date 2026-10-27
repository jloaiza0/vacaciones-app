// Utilidades para limpiar y validar lo que se escribe en los formularios.

// Cédula sin puntos, comas ni espacios y en mayúsculas (por si trae letras, como un pasaporte).
// "1.094.123.456", " 1094123456 " y "1094123456" quedan iguales.
function normalizarCedula(texto) {
  return String(texto ?? '').replace(/[.,\s]/g, '').toUpperCase();
}

// Para buscar sin importar tildes ni mayúsculas: "Ramírez" coincide con "ramirez".
function sinTildes(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// 'YYYY-MM-DD' que sea una fecha real (rechaza 2026-13-45, 2026-02-30, texto, etc.)
function fechaISOValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

// Salario escrito como lo escribe la gente: 3200000, 3.200.000, 3,200,000, $3.200.000,
// 3 200 000, 3.200.000,50 ...  Devuelve { ok: true, valor } (valor null si está vacío)
// o { ok: false } si no se puede entender: nunca se descarta en silencio.
// Regla: un solo separador seguido de 1 o 2 dígitos es decimal ("1500,5"); seguido de 3
// dígitos, o repetido, son miles ("3.200", "3.200.000"). Si hay punto y coma, el último es el decimal.
function parsearSalario(entrada) {
  if (entrada === undefined || entrada === null) return { ok: true, valor: null };
  if (typeof entrada === 'number') {
    return Number.isFinite(entrada) && entrada >= 0 ? { ok: true, valor: entrada } : { ok: false };
  }
  const crudo = String(entrada).trim();
  if (crudo === '') return { ok: true, valor: null }; // campo vacío = sin salario
  const texto = crudo.replace(/[$\s]/g, '');
  if (!/^\d[\d.,]*$/.test(texto)) return { ok: false }; // incluye "$" solo: algo escribió, pero no hay número

  const ultimoPunto = texto.lastIndexOf('.');
  const ultimaComa = texto.lastIndexOf(',');

  let decimal = null;
  if (ultimoPunto !== -1 && ultimaComa !== -1) {
    decimal = ultimoPunto > ultimaComa ? '.' : ','; // el que va al final
  } else {
    const separador = ultimoPunto !== -1 ? '.' : ultimaComa !== -1 ? ',' : null;
    if (separador) {
      const partes = texto.split(separador);
      const despues = partes[partes.length - 1];
      if (partes.length === 2 && despues.length >= 1 && despues.length <= 2) decimal = separador;
    }
  }

  let parteEntera = texto;
  let parteDecimal = '';
  if (decimal) {
    const corte = texto.lastIndexOf(decimal);
    parteEntera = texto.slice(0, corte);
    parteDecimal = texto.slice(corte + 1);
  }

  // Parte entera: solo dígitos, o grupos de miles bien formados con el mismo separador
  const enteraOk = /^\d+$/.test(parteEntera) || /^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(parteEntera);
  const decimalOk = parteDecimal === '' || /^\d{1,2}$/.test(parteDecimal);
  if (!enteraOk || !decimalOk) return { ok: false };

  return { ok: true, valor: Number(parteEntera.replace(/[.,]/g, '') + (parteDecimal ? `.${parteDecimal}` : '')) };
}

module.exports = { normalizarCedula, sinTildes, fechaISOValida, parsearSalario };