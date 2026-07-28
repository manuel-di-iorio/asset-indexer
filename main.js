const { app, BrowserWindow } = require('electron');
const path = require('path');
const { initDatabase, getDb } = require('./src/main/database');
const { registerIpcHandlers } = require('./src/main/ipc-handlers');
const { setupWatcher, stopAllWatchers } = require('./src/main/watchers');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0D1020',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    icon: app.isPackaged
      ? path.join(__dirname, '..', 'src', 'renderer', 'icon.ico')
      : path.join(__dirname, 'src', 'renderer', 'icon.ico')
  });

  mainWindow.maximize();
  mainWindow.show();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function getMainWindow() {
  return mainWindow;
}

app.whenReady().then(() => {
  initDatabase();
  const db = getDb();

  registerIpcHandlers(db, getMainWindow, app);
  createWindow();

  const libraries = db.prepare('SELECT * FROM libraries').all();
  libraries.forEach(lib => {
    setupWatcher(db, mainWindow, lib.path, lib.id, lib.ignore_regex);
  });
});

app.on('window-all-closed', () => {
  stopAllWatchers();
  const db = getDb();
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});
