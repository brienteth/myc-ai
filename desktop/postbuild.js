import fs from 'fs';
import path from 'path';

const distIndex = path.join('dist', 'index.html');
const rootAppHtml = path.resolve('..', 'app.html');
const distAssets = path.join('dist', 'assets');
const rootAssets = path.resolve('..', 'assets');

if (fs.existsSync(distIndex)) {
  let content = fs.readFileSync(distIndex, 'utf8');
  content = content.replace(/crossorigin/g, '');
  fs.writeFileSync(distIndex, content, 'utf8');
  fs.writeFileSync(rootAppHtml, content, 'utf8');
  console.log('Postbuild: Synchronized dist/index.html to root app.html');
} else {
  console.error('Postbuild: dist/index.html not found');
}

if (fs.existsSync(distAssets)) {
  if (!fs.existsSync(rootAssets)) {
    fs.mkdirSync(rootAssets, { recursive: true });
  }
  const files = fs.readdirSync(distAssets);
  for (const f of files) {
    fs.copyFileSync(path.join(distAssets, f), path.join(rootAssets, f));
  }
  console.log('Postbuild: Synchronized dist/assets to root assets/');
}

// Copy top-level dist static files (e.g. logo.png, icon.png) to root
if (fs.existsSync('dist')) {
  const distFiles = fs.readdirSync('dist');
  for (const f of distFiles) {
    const fullPath = path.join('dist', f);
    if (!fs.lstatSync(fullPath).isDirectory() && f !== 'index.html') {
      fs.copyFileSync(fullPath, path.resolve('..', f));
    }
  }
  console.log('Postbuild: Synchronized dist root static files to main root');
}

