const fs = require('fs');
const path = require('path');

const MAX_HEAD = 64 * 1024;

function readHead(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(MAX_HEAD);
    const bytesRead = fs.readSync(fd, buf, 0, MAX_HEAD, 0);
    fs.closeSync(fd);
    return buf.subarray(0, bytesRead);
  } catch (e) {
    return null;
  }
}

function parsePNG(b) {
  if (b.length < 33) return null;
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  if (b.toString('ascii', 12, 16) !== 'IHDR') return null;
  const colorType = b[25];
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    bitDepth: b[24],
    hasAlpha: colorType === 4 || colorType === 6 ? 1 : 0
  };
}

function parseJPEG(b) {
  if (b.length < 4) return null;
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let off = 2;
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) { off++; continue; }
    const marker = b[off + 1];
    if (marker === 0xff) { off++; continue; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
    const len = b.readUInt16BE(off + 2);
    if (len < 2 || off + 2 + len > b.length) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (len < 8) return null;
      return {
        width: b.readUInt16BE(off + 7),
        height: b.readUInt16BE(off + 5),
        bitDepth: b[off + 4],
        hasAlpha: 0
      };
    }
    off += 2 + len;
  }
  return null;
}

function parseWebP(b) {
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = b.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    const flags = b[20];
    const width = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
    const height = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
    return { width, height, bitDepth: 8, hasAlpha: (flags & 0x10) ? 1 : 0 };
  }
  if (fourcc === 'VP8 ') {
    const width = (b.readUInt16LE(26) & 0x3fff) + 1;
    const height = (b.readUInt16LE(28) & 0x3fff) + 1;
    return { width, height, bitDepth: 8, hasAlpha: 0 };
  }
  if (fourcc === 'VP8L') {
    const w14 = b[21] | ((b[22] & 0x3f) << 8);
    const h14 = ((b[22] >> 6) & 0x03) | (b[23] << 2) | ((b[24] & 0x0f) << 10);
    const alpha = (b[24] >> 4) & 1;
    return { width: w14 + 1, height: h14 + 1, bitDepth: 8, hasAlpha: alpha };
  }
  return null;
}

function parseGIF(b) {
  if (b.length < 10) return null;
  const sig = b.toString('ascii', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return {
    width: b.readUInt16LE(6),
    height: b.readUInt16LE(8),
    bitDepth: null,
    hasAlpha: null
  };
}

function parseBMP(b) {
  if (b.length < 30 || b.toString('ascii', 0, 2) !== 'BM') return null;
  return {
    width: b.readInt32LE(18),
    height: Math.abs(b.readInt32LE(22)),
    bitDepth: b.readUInt16LE(28),
    hasAlpha: 0
  };
}

function parseICO(b) {
  if (b.length < 6) return null;
  if (b.readUInt16LE(0) !== 0 || b.readUInt16LE(2) !== 1) return null;
  const count = b.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    if (off + 16 > b.length) break;
    const w = b[off] || 256;
    const h = b[off + 1] || 256;
    if (!best || w > best.w) best = { w, h };
  }
  if (!best) return null;
  return { width: best.w, height: best.h, bitDepth: null, hasAlpha: null };
}

function parseTGA(b) {
  if (b.length < 18) return null;
  const imageType = b[2];
  if (imageType !== 1 && imageType !== 2 && imageType !== 3 && imageType !== 9 && imageType !== 10 && imageType !== 11) return null;
  const width = b.readUInt16LE(12);
  const height = b.readUInt16LE(14);
  const depth = b[16];
  if (width === 0 || height === 0) return null;
  return { width, height, bitDepth: depth, hasAlpha: depth >= 32 ? 1 : 0 };
}

function parsePSD(b) {
  if (b.length < 26) return null;
  if (b.toString('ascii', 0, 4) !== '8BPS') return null;
  const height = b.readUInt32BE(14);
  const width = b.readUInt32BE(18);
  const depth = b.readUInt16BE(22);
  if (width === 0 || height === 0) return null;
  return { width, height, bitDepth: depth, hasAlpha: null };
}

function parseDDS(b) {
  if (b.length < 20 || b.toString('ascii', 0, 4) !== 'DDS ') return null;
  return {
    width: b.readUInt32LE(16),
    height: b.readUInt32LE(12),
    bitDepth: null,
    hasAlpha: null
  };
}

function parseKTX(b) {
  if (b.length < 44) return null;
  if (b.toString('latin1', 0, 12) !== '\u00abKTX 11\u00bb\r\n\x1a\n') return null;
  return {
    width: b.readUInt32LE(36),
    height: b.readUInt32LE(40),
    bitDepth: null,
    hasAlpha: null
  };
}

function extractImageMetadata(filePath) {
  const b = readHead(filePath);
  if (!b || b.length < 4) return null;
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return parsePNG(b);
    case '.jpg':
    case '.jpeg': return parseJPEG(b);
    case '.webp': return parseWebP(b);
    case '.gif': return parseGIF(b);
    case '.bmp': return parseBMP(b);
    case '.ico': return parseICO(b);
    case '.tga': return parseTGA(b);
    case '.psd': return parsePSD(b);
    case '.dds': return parseDDS(b);
    case '.ktx': return parseKTX(b);
    default: return null;
  }
}

module.exports = { extractImageMetadata };
