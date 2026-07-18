const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');


const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

let backendProcess = null;

function startBackend() {
  const isDev = process.env.NODE_ENV === 'development';
  const isWin = process.platform === 'win32';
  
  let backendPath;
  if (isDev) {
    // In dev, assuming we run python backend manually or it's somewhere else
    console.log('[Main] Running in dev mode, assuming backend is started manually.');
    return;
  } else {
    // In production, the backend executable should be in resources
    const exeName = isWin ? 'myca-backend.exe' : 'myca-backend';
    backendPath = path.join(process.resourcesPath, 'backend', exeName);
  }
  
  if (!fs.existsSync(backendPath)) {
    console.error('[Main] Backend executable not found at:', backendPath);
    return;
  }

  console.log('[Main] Starting backend at:', backendPath);
  
  backendProcess = spawn(backendPath, [], {
    detached: false,
    stdio: 'inherit' // forward logs to parent
  });
  
  backendProcess.on('error', (err) => {
    console.error('[Main] Failed to start backend:', err);
  });
  
  backendProcess.on('close', (code) => {
    console.log('[Main] Backend exited with code', code);
  });
}

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
  startBackend();
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
  if (backendProcess) {
    backendProcess.kill();
  }
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
