const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: 'hiddenInset', // Apple-level feel
    vibrancy: 'sidebar', // macOS glassmorphism
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // For prototype speed
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Forward console logs from renderer to main process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  // Hide instead of close when X is clicked (to act like a menu bar app)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function registerShortcuts() {
  // Command Palette global shortcut
  globalShortcut.register('CommandOrControl+K', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.send('open-command-palette');
    }
  });
  
  globalShortcut.register('CommandOrControl+Space', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.send('open-command-palette');
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// IPC handlers for OS integration can be added here
ipcMain.on('get-device-info', (event) => {
  event.reply('device-info', {
    platform: process.platform,
    arch: process.arch,
    cpus: require('os').cpus().length,
    ram: require('os').totalmem()
  });
});
