const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let backendProcess = null;

let backendReady = false;

function startBackend() {
  if (isDev) {
    console.log('[Main] Dev mode — backend must be started manually.');
    backendReady = true;
    return;
  }

  const isWin = process.platform === 'win32';
  const exeName = isWin ? 'myca-backend.exe' : 'myca-backend';
  let backendPath = path.join(process.resourcesPath, 'backend', exeName);
  let spawnCmd = backendPath;
  let spawnArgs = [];

  if (!fs.existsSync(backendPath)) {
    console.warn('[Main] Standalone backend binary not found at:', backendPath);
    // Fallback: check if local python main.py exists
    const pyMain = path.join(app.getAppPath(), '..', 'ai-layer', 'main.py');
    const pyMainAlt = path.join(process.resourcesPath, 'ai-layer', 'main.py');
    
    if (fs.existsSync(pyMain)) {
      spawnCmd = isWin ? 'python' : 'python3';
      spawnArgs = [pyMain];
    } else if (fs.existsSync(pyMainAlt)) {
      spawnCmd = isWin ? 'python' : 'python3';
      spawnArgs = [pyMainAlt];
    } else {
      console.error('[Main] Neither backend binary nor ai-layer/main.py found.');
      waitForBackendHealth();
      return;
    }
  }

  console.log('[Main] Starting backend:', spawnCmd, spawnArgs, 'in CWD:', app.getPath('userData'));

  backendProcess = spawn(spawnCmd, spawnArgs, {
    cwd: app.getPath('userData'),
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    console.log(`[Backend] ${msg}`);
    // Detect when uvicorn starts listening
    if (msg.includes('Uvicorn running') || msg.includes('Application startup complete')) {
      console.log('[Main] Backend HTTP server detected as running');
      waitForBackendHealth();
    }
  });

  backendProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    console.log(`[Backend:err] ${msg}`);
    if (msg.includes('Uvicorn running') || msg.includes('Application startup complete')) {
      console.log('[Main] Backend HTTP server detected as running (stderr)');
      waitForBackendHealth();
    }
  });

  backendProcess.on('error', (err) => {
    console.error('[Main] Backend error:', err);
  });

  backendProcess.on('close', (code) => {
    console.log('[Main] Backend exited with code', code);
    backendReady = false;
  });

  // Also start polling health immediately in case we miss the log line
  waitForBackendHealth();
}

function waitForBackendHealth() {
  const http = require('http');
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes max

  const check = () => {
    if (backendReady) return; // already ready
    attempts++;
    if (attempts > maxAttempts) {
      console.error('[Main] Backend health check timed out after', maxAttempts, 'attempts');
      return;
    }

    const req = http.get('http://127.0.0.1:8420/health', (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('[Main] Backend is healthy!');
          backendReady = true;
          // Notify renderer that backend is ready
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('backend-ready', true);
          }
        } else {
          setTimeout(check, 1000);
        }
      });
    });
    req.on('error', () => {
      setTimeout(check, 1000);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      setTimeout(check, 1000);
    });
  };

  check();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function registerShortcuts() {
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

ipcMain.on('get-device-info', (event) => {
  event.reply('device-info', {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    ram: os.totalmem()
  });
});
