// Formatea 'YYYY-MM-DD' como "8 oct 2004".
// Importante: se arma con T00:00:00 para que el navegador la lea en hora local
// y no se corra un día hacia atrás por la diferencia de zona horaria (bug clásico).
export function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(`${fechaISO}T00:00:00`);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(fecha)
    .replace('.', '');
}

// Formatea un número como pesos colombianos: $1.850.000
export function formatearDinero(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

// "1 día" / "2 días"
export function pluralDias(n) {
  const numero = Number(n) || 0;
  return `${numero} ${numero === 1 ? 'día' : 'días'}`;
}