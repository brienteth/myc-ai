import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve('/Users/bl10buer/Desktop/myca-private-main/desktop/src');
const TARGET_PATTERN = /127\.0\.0\.1:8420|localhost:8420/;

function getFiles(dir, files = []) {
  const dirContents = fs.readdirSync(dir);
  for (const file of dirContents) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, files);
    } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      files.push(filePath);
    }
  }
  return files;
}

let errors = [];
const files = getFiles(SRC_DIR);

for (const file of files) {
  if (file.endsWith('main.jsx') || file.endsWith('Colony.jsx')) {
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Strip comments, ignoring protocol slashes in http:// or https://
    let cleanLine = line.replace(/(?<!http:|https:)\/\/.*$/, '');

    // Simple block comment line strip
    if (cleanLine.trim().startsWith('*') || cleanLine.trim().startsWith('/*')) {
      return;
    }

    if (TARGET_PATTERN.test(cleanLine)) {
      // Whitelist only if it uses window.getBackendUrl as a dynamic fallback
      const hasResolver = cleanLine.includes('window.getBackendUrl') || cleanLine.includes('getBackendUrl()');
      if (!hasResolver) {
        errors.push({
          file: path.relative('/Users/bl10buer/Desktop/myca-private-main/desktop', file),
          line: idx + 1,
          content: line.trim()
        });
      }
    }
    // Reset regex state since it has global flag
    TARGET_PATTERN.lastIndex = 0;
  });
}

if (errors.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', '=== HARDCODED BACKEND URL AUDIT FAILED ===');
  console.error(`Found ${errors.length} hardcoded URL violation(s). All backend URLs must resolve dynamically.`);
  console.error('Use standard dynamic resolver block:');
  console.error("  const backendUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://127.0.0.1:8420';\n");

  errors.forEach(err => {
    console.error(`\x1b[33m${err.file}:${err.line}\x1b[0m: ${err.content}`);
  });
  console.error('==========================================');
  process.exit(1);
} else {
  console.log('\x1b[32m%s\x1b[0m', '✓ Hardcoded backend URL audit passed. (0 violations)');
  process.exit(0);
}
