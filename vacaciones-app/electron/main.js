const { app, BrowserWindow } = require('electron');
const path = require('path');

// En desarrollo, el servidor ya lo arranca el script "dev:server" con Node normal
// (así funciona el proxy de Vite). Solo cuando la app está empaquetada, Electron
// mismo arranca el servidor embebido dentro de este proceso.
if (app.isPackaged) {
  require('./server');
}

const PUERTO = process.env.PUERTO || 4321;
const esDev = !app.isPackaged;

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (esDev) {
    ventana.loadURL('http://localhost:5173');
  } else {
    ventana.loadURL(`http://localhost:${PUERTO}`);
  }
}

app.whenReady().then(crearVentana);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});