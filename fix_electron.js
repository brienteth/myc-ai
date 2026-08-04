const fs = require('fs');
const path = require('path');

const electronCjsPath = '/Users/bl10buer/Desktop/myca/desktop/electron.cjs';
let content = fs.readFileSync(electronCjsPath, 'utf8');

// We need to add backend spawning code
const spawnCode = `
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
`;

// Insert after the requires
content = content.replace("const isDev = process.env.NODE_ENV === 'development';", spawnCode + "\nconst isDev = process.env.NODE_ENV === 'development';");

// Insert startBackend() in app.whenReady
content = content.replace("createWindow();", "startBackend();\n  createWindow();");

// Kill backend on quit
content = content.replace("app.on('before-quit', () => {", "app.on('before-quit', () => {\n  if (backendProcess) {\n    backendProcess.kill();\n  }");

fs.writeFileSync(electronCjsPath, content);
console.log("Updated electron.cjs");
