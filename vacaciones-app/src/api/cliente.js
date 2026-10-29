const BASE = '/api';

// App.jsx registra aquí qué hacer cuando el servidor dice que la sesión ya no sirve.
// Las páginas públicas (consulta) no registran nada y no se ven afectadas.
let alSesionExpirada = null;
let alCambioObligatorio = null;
export function registrarManejadoresDeSesion({ sesionExpirada, cambioObligatorio }) {
  alSesionExpirada = sesionExpirada;
  alCambioObligatorio = cambioObligatorio;
}

async function solicitud(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));

    // 401 = la sesión ya no existe (el servidor se reinició o pasaron 12 horas).
    // El login también responde 401 cuando la clave está mal: ese caso NO es sesión caída.
    if (res.status === 401 && ruta !== '/auth/login') {
      alSesionExpirada?.();
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    }
    // El servidor exige cambiar la contraseña (p. ej. se restableció con el script de emergencia
    // mientras esta sesión seguía abierta)
    if (res.status === 403 && cuerpo.codigo === 'CAMBIO_OBLIGATORIO') {
      alCambioObligatorio?.();
      throw new Error(cuerpo.error);
    }
    throw new Error(cuerpo.error || 'Error en la solicitud');
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  login: (usuario, password) =>
    solicitud('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) }),
  logout: () => solicitud('/auth/logout', { method: 'POST' }),
  cambiarPassword: (passwordActual, passwordNueva) =>
    solicitud('/auth/cambiar-password', {
      method: 'POST',
      body: JSON.stringify({ passwordActual, passwordNueva }),
    }),

  listarTrabajadores: (estado = 'activos') => solicitud(`/trabajadores?estado=${estado}`),
  obtenerTrabajador: (id) => solicitud(`/trabajadores/${id}`),
  crearTrabajador: (datos) => solicitud('/trabajadores', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarTrabajador: (id, datos) =>
    solicitud(`/trabajadores/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarTrabajador: (id) => solicitud(`/trabajadores/${id}`, { method: 'DELETE' }),
  eliminarTrabajadorDefinitivo: (id) => solicitud(`/trabajadores/${id}/definitivo`, { method: 'DELETE' }),
  activarTrabajador: (id) => solicitud(`/trabajadores/${id}/activar`, { method: 'POST' }),

  crearPeriodo: (datos) => solicitud('/periodos', { method: 'POST', body: JSON.stringify(datos) }),
  obtenerPeriodo: (id) => solicitud(`/periodos/${id}`),
  actualizarPeriodo: (id, datos) => solicitud(`/periodos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminarPeriodo: (id) => solicitud(`/periodos/${id}`, { method: 'DELETE' }),
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

  estadoRespaldos: () => solicitud('/respaldos/estado'),
  respaldarAhora: () => solicitud('/respaldos/ahora', { method: 'POST' }),

  consultarTrabajadores: (q = '') => solicitud(`/consulta/trabajadores?q=${encodeURIComponent(q)}`),
  consultarTrabajador: (id) => solicitud(`/consulta/trabajadores/${id}`),
  consultarPeriodo: (id) => solicitud(`/consulta/periodos/${id}`),
};