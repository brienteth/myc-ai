import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdr = createChunk("IHDR", ihdrData);

  // Generate pixels (circular glowing cyan/emerald badge on dark background)
  const rows = [];
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte 0
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Neon cyan / teal gradient (#00f2fe to #4facfe)
        const t = (x + y) / (size * 2);
        const r = Math.floor(0 + t * 40);
        const g = Math.floor(220 + t * 35);
        const b = Math.floor(240 - t * 20);
        row.push(r, g, b, 255);
      } else if (dist <= radius + 1) {
        // Soft anti-aliasing
        row.push(0, 200, 220, 120);
      } else {
        // Transparent outside
        row.push(0, 0, 0, 0);
      }
    }
    rows.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk("IDAT", compressed);
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

const iconsDir = path.resolve("chrome-extension/icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const pngBuf = generatePng(size);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${size}x${size}, ${pngBuf.length} bytes)`);
}
