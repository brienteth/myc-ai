/**
 * Safetensors Parser Module
 * Parsers HuggingFace .safetensors files natively in JavaScript.
 * Read more: https://github.com/huggingface/safetensors
 */

import fs from 'fs';

export class SafetensorsParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.fd = null;
    this.header = {};
    this.headerLength = 0;
  }

  open() {
    this.fd = fs.openSync(this.filePath, 'r');
    
    // 1. Read first 8 bytes for header length (uint64 little endian)
    const lenBuf = Buffer.alloc(8);
    fs.readSync(this.fd, lenBuf, 0, 8, 0);
    
    // Convert to number (safe for safe-tensors headers < 9PB)
    this.headerLength = Number(lenBuf.readBigUInt64LE(0));
    
    // 2. Read JSON header
    const headerBuf = Buffer.alloc(this.headerLength);
    fs.readSync(this.fd, headerBuf, 0, this.headerLength, 8);
    this.header = JSON.parse(headerBuf.toString('utf8'));
  }

  getTensorNames() {
    return Object.keys(this.header).filter(key => key !== '__metadata__');
  }

  readTensor(tensorName) {
    const meta = this.header[tensorName];
    if (!meta) return null;

    const [start, end] = meta.data_offsets;
    const byteLength = end - start;
    
    const dataBuf = Buffer.alloc(byteLength);
    // Offset in file is: 8 (length field) + headerLength + start_offset
    fs.readSync(this.fd, dataBuf, 0, byteLength, 8 + this.headerLength + start);

    if (meta.dtype === 'F32') {
      // Float32 arrays are 4 bytes per element
      return new Float32Array(dataBuf.buffer, dataBuf.byteOffset, byteLength / 4);
    }
    
    return dataBuf;
  }

  close() {
    if (this.fd) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}
