const express = require('express');
const { crearRespaldoManual, estadoRespaldos } = require('../services/respaldos');

const router = express.Router();

router.get('/estado', (req, res) => {
  res.json(estadoRespaldos());
});

router.post('/ahora', async (req, res) => {
  try {
    const resultado = await crearRespaldoManual();
    if (!resultado.local.ok) {
      return res.status(500).json({ error: `No se pudo crear el respaldo: ${resultado.local.error}` });
    }
    res.json({ ...resultado, estado: estadoRespaldos() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;