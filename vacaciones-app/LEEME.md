# Gestión de vacaciones

## Para empezar
1. npm install
2. npm run dev   -> abre la app en modo desarrollo (Vite + servidor + Electron)

La primera vez que arranca crea data/vacaciones.db solo, con el schema.sql.
Usuario por defecto: admin / admin123 (cámbialo con /api/auth/cambiar-password).

Vista de consulta (solo lectura, sin login), abrir en el navegador:
http://localhost:4321/#/consulta   (en dev, http://localhost:5173/#/consulta)

## Para empaquetar el instalador
1. npm run build

## Pendiente / a revisar contigo
- El importador de Excel (electron/server/services/importadorExcel.js) todavía
  no separa las "FECHAS DISFRUTADAS" en tomas_vacaciones individuales: ese texto
  viene demasiado inconsistente en el Excel original (mezcla separadores '-' para
  fecha y para rango). Por ahora el periodo se importa completo (con SC y LNR),
  pero las tomas de vacaciones de la carga inicial hay que cargarlas a mano desde
  la ficha de cada trabajador, o afinamos el parser juntos con más ejemplos reales.
- La vista de consulta se sirve en la misma app (ruta /consulta) sin pedir login;
  falta abrir el puerto 4321 en el Firewall de Windows de la máquina principal.
- Los formularios de tomas/SC/LNR usan prompt() de navegador por ahora (simples,
  para probar el flujo) — hay que cambiarlos por formularios reales en el detalle
  de periodo.
- Falta el respaldo automático diario del archivo .db.
