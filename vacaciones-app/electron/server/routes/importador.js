const express = require('express');
const multer = require('multer');
const { parsearExcel, importarRegistros } = require('../services/importadorExcel');

const router = express.Router();
const upload = multer({ dest: require('os').tmpdir() });

// Previsualiza: parsea el Excel y devuelve el resumen, sin tocar la base de datos
router.post('/previsualizar', upload.single('archivo'), (req, res) => {
  try {
    const { registros, filasRevisar } = parsearExcel(req.file.path);
    res.json({
      totalFilas: registros.length,
      filasRevisar,
      registros, // el front los reenvía tal cual a /confirmar si el usuario aprueba
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Confirma: recibe los mismos registros ya revisados y los guarda
router.post('/confirmar', express.json({ limit: '20mb' }), (req, res) => {
  try {
    const resultado = importarRegistros(req.body.registros || []);
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
