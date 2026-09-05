/**
 * 48-Byte Compact Binary Protocol Frame for MYC Network
 * Operates on serial lines (RS-485, CAN-bus, BLE, LoRa, UDP)
 * 
 * Frame Structure (48 Bytes total):
 * [0..1]   Magic Header: 0x4D 0x59 ("MY")
 * [2]      Version: 0x01
 * [3]      Status: 0x00 (OK) / 0xE5 (NEGATION)
 * [4..5]   Target Coil Register (Big Endian)
 * [6..7]   Action Value: 0xFF00 (START) / 0x0000 (STOP)
 * [8..39]  Proof-of-Resonance (PoR) Hash (32 Bytes)
 * [40..45] Modbus RTU Payload (6 Bytes)
 * [46..47] Frame CRC-16 Checksum (2 Bytes)
 */
export class MycBinaryFrame {
  static serialize({ status, targetRegister, actionValue, porHash, modbusFrame }) {
    const buf = Buffer.alloc(48);
    buf.write("MY", 0, 2, "ascii");
    buf.writeUInt8(0x01, 2);
    buf.writeUInt8(status || 0, 3);
    buf.writeUInt16BE(targetRegister || 0, 4);
    buf.writeUInt16BE(actionValue || 0, 6);

    // Write 32 bytes PoR hash
    const cleanHash = (porHash || "").replace(/^0x/, "").padEnd(64, "0");
    Buffer.from(cleanHash, "hex").copy(buf, 8, 0, 32);

    // Modbus 6 bytes
    if (modbusFrame && modbusFrame.length >= 6) {
      Buffer.from(modbusFrame).copy(buf, 40, 0, 6);
    }

    // CRC16 over first 46 bytes
    const crc = this.calculateCrc16(buf.subarray(0, 46));
    buf.writeUInt16BE(crc, 46);

    return buf;
  }

  static deserialize(buf) {
    if (!buf || buf.length < 48) throw new Error("Invalid MYC binary frame length");
    if (buf.toString("ascii", 0, 2) !== "MY") throw new Error("Invalid MYC magic header");

    const version = buf.readUInt8(2);
    const status = buf.readUInt8(3);
    const targetRegister = buf.readUInt16BE(4);
    const actionValue = buf.readUInt16BE(6);
    const porHash = "0x" + buf.subarray(8, 40).toString("hex");
    const modbusFrame = Array.from(buf.subarray(40, 46));
    const crc = buf.readUInt16BE(46);

    const calculatedCrc = this.calculateCrc16(buf.subarray(0, 46));
    const isValidCrc = crc === calculatedCrc;

    return { version, status, targetRegister, actionValue, porHash, modbusFrame, isValidCrc };
  }

  static calculateCrc16(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x0001) !== 0) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }
}
