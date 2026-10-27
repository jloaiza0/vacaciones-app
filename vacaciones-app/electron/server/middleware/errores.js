// Respuestas uniformes en JSON para lo que nadie más atendió. Sin esto, Express contesta
// con una página HTML que incluye rutas internas del código, y la app solo mostraría
// "Error en la solicitud".

// Cualquier /api/... que no exista
function apiNoEncontrada(req, res) {
  res.status(404).json({ error: 'No encontrado' });
}

// Va siempre al final de todo. El detalle técnico se queda en la consola del servidor.
function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);
  console.error(`Error en ${req.method} ${req.originalUrl}:`, err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'La solicitud no es válida' });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { apiNoEncontrada, manejarErrores };