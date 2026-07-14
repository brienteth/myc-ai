import fs from 'fs';
import path from 'path';

const file = path.join('dist', 'index.html');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/crossorigin/g, '');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Postbuild: Removed crossorigin from dist/index.html');
} else {
  console.error('Postbuild: dist/index.html not found');
}
