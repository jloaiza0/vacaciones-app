const BASE = '/api';

async function solicitud(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new Error(cuerpo.error || 'Error en la solicitud');
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  login: (usuario, password) =>
    solicitud('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
  logout: () => solicitud('/auth/logout', { method: 'POST' }),

  listarTrabajadores: (estado = 'activos') => solicitud(`/trabajadores?estado=${estado}`),
  obtenerTrabajador: (id) => solicitud(`/trabajadores/${id}`),
  crearTrabajador: (datos) => solicitud('/trabajadores', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarTrabajador: (id, datos) =>
    solicitud(`/trabajadores/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarTrabajador: (id) => solicitud(`/trabajadores/${id}`, { method: 'DELETE' }),
  activarTrabajador: (id) => solicitud(`/trabajadores/${id}/activar`, { method: 'POST' }),

  crearPeriodo: (datos) => solicitud('/periodos', { method: 'POST', body: JSON.stringify(datos) }),
  obtenerPeriodo: (id) => solicitud(`/periodos/${id}`),
  actualizarPeriodo: (id, datos) => solicitud(`/periodos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  agregarToma: (id, datos) => solicitud(`/periodos/${id}/tomas`, { method: 'POST', body: JSON.stringify(datos) }),
  editarToma: (id, tomaId, datos) =>
    solicitud(`/periodos/${id}/tomas/${tomaId}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarToma: (id, tomaId) => solicitud(`/periodos/${id}/tomas/${tomaId}`, { method: 'DELETE' }),
  agregarSuspension: (id, datos) =>
    solicitud(`/periodos/${id}/suspensiones`, { method: 'POST', body: JSON.stringify(datos) }),
  editarSuspension: (id, suspId, datos) =>
    solicitud(`/periodos/${id}/suspensiones/${suspId}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarSuspension: (id, suspId) => solicitud(`/periodos/${id}/suspensiones/${suspId}`, { method: 'DELETE' }),
  agregarLicencia: (id, datos) =>
    solicitud(`/periodos/${id}/licencias`, { method: 'POST', body: JSON.stringify(datos) }),
  editarLicencia: (id, licId, datos) =>
    solicitud(`/periodos/${id}/licencias/${licId}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarLicencia: (id, licId) => solicitud(`/periodos/${id}/licencias/${licId}`, { method: 'DELETE' }),

  consultarTrabajadores: (q = '') => solicitud(`/consulta/trabajadores?q=${encodeURIComponent(q)}`),
  consultarTrabajador: (id) => solicitud(`/consulta/trabajadores/${id}`),
  consultarPeriodo: (id) => solicitud(`/consulta/periodos/${id}`),
};