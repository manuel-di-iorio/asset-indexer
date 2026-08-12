const fs = require('fs');
const path = require('path');

const LICENSE_FILENAME_RE = /^(LICENSE|LICENCE|COPYING|COPYRIGHT|UNLICENSE)(\.[A-Za-z0-9_-]+)?$/i;
const MAX_HEAD_BYTES = 2 * 1024 * 1024;
const MAX_LICENSE_VALUE = 120;

function readHead(filePath, maxBytes) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
    fs.closeSync(fd);
    return buf.subarray(0, bytesRead);
  } catch (e) {
    return null;
  }
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LICENSE_RULES = [
  [/mit zero|mit-0/, 'MIT-0'],
  [/permission is hereby granted, free of charge, to any person obtaining a copy/, 'MIT'],
  [/mit license/, 'MIT'],
  [/apache license[\s,]*version[\s,]*2/, 'Apache-2.0'],
  [/apache software license/, 'Apache-2.0'],
  [/bsd[\s-]*3[\s-]*clause/, 'BSD-3-Clause'],
  [/bsd[\s-]*2[\s-]*clause/, 'BSD-2-Clause'],
  [/redistribution and use in source and binary forms/, 'BSD'],
  [/gnu (affero )?general public license[\s\w]*version 3/, 'AGPL-3.0'],
  [/gnu general public license[\s\w]*version 3/, 'GPL-3.0'],
  [/gnu general public license[\s\w]*version 2/, 'GPL-2.0'],
  [/gnu general public license/, 'GPL'],
  [/gnu (lesser|library) general public license[\s\w]*version 3/, 'LGPL-3.0'],
  [/gnu (lesser|library) general public license[\s\w]*version 2/, 'LGPL-2.1'],
  [/gnu (lesser|library) general public license/, 'LGPL'],
  [/permission to use, copy, modify, and\/or distribute this software/, 'ISC'],
  [/isc license/, 'ISC'],
  [/this software is provided 'as-is', without any express or implied warranty/, 'zlib'],
  [/zlib license/, 'zlib'],
  [/unlicense/, 'Unlicense'],
  [/creative commons attribution[-\s]noncommercial[-\s]sharealike/, 'CC BY-NC-SA'],
  [/creative commons attribution[-\s]noncommercial[-\s]noderivatives/, 'CC BY-NC-ND'],
  [/creative commons attribution[-\s]noncommercial/, 'CC BY-NC'],
  [/creative commons attribution[-\s]sharealike/, 'CC BY-SA'],
  [/creative commons attribution[-\s]noderivatives/, 'CC BY-ND'],
  [/creative commons attribution/, 'CC BY'],
  [/creative commons zero|cc0[^\w]/, 'CC0'],
  [/creative commons public domain/, 'CC0'],
  [/do what the fuck you want|wtfpl/, 'WTFPL'],
  [/all rights reserved/, 'All Rights Reserved'],
  [/proprietary/, 'Proprietary']
];

function classifyLicense(content) {
  const text = normalize(content);
  if (!text) return null;
  for (const [re, label] of LICENSE_RULES) {
    if (re.test(text)) return label;
  }
  return null;
}

function detectFromLicenseFile(assetDir, libraryRoot) {
  let dir = assetDir;
  while (dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      entries = [];
    }
    let fallbackName = null;
    for (const entry of entries) {
      if (entry.isFile() && LICENSE_FILENAME_RE.test(entry.name)) {
        const filePath = path.join(dir, entry.name);
        let content = '';
        try { content = fs.readFileSync(filePath, 'utf-8').substring(0, 64 * 1024); } catch (e) {}
        const label = classifyLicense(content);
        if (label) return label;
        if (!fallbackName) fallbackName = entry.name;
      }
    }
    if (fallbackName) return fallbackName;
    if (libraryRoot && path.resolve(dir) === path.resolve(libraryRoot)) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function syncsafeInt(b, off) {
  return ((b[off] & 0x7f) << 21) | ((b[off + 1] & 0x7f) << 14) | ((b[off + 2] & 0x7f) << 7) | (b[off + 3] & 0x7f);
}

function isUtf16(enc) {
  return enc === 1 || enc === 2;
}

function decodeText(buf, enc) {
  try {
    if (isUtf16(enc)) return buf.toString('utf16le').replace(/^\uFEFF/, '').replace(/\0+$/g, '').trim();
    if (enc === 3) return buf.toString('utf8').replace(/\0+$/g, '').trim();
    return buf.toString('latin1').replace(/\0+$/g, '').trim();
  } catch (e) {
    return '';
  }
}

function decodeTerminated(buf, pos, enc) {
  if (isUtf16(enc)) {
    let i = pos;
    while (i + 1 < buf.length) {
      if (buf[i] === 0 && buf[i + 1] === 0) {
        return { value: buf.toString('utf16le', pos, i).replace(/^\uFEFF/, ''), bytes: i - pos };
      }
      i += 2;
    }
    return { value: decodeText(buf.subarray(pos), enc), bytes: buf.length - pos };
  }
  let i = pos;
  while (i < buf.length) {
    if (buf[i] === 0) return { value: buf.toString('utf8', pos, i), bytes: i - pos };
    i++;
  }
  return { value: buf.toString('utf8', pos), bytes: buf.length - pos };
}

function parseTextFrame(data) {
  if (data.length < 1) return null;
  return decodeText(data.subarray(1), data[0]);
}

function parseTXXX(data) {
  if (data.length < 2) return null;
  const enc = data[0];
  const desc = decodeTerminated(data, 1, enc);
  const pos = 1 + desc.bytes + (isUtf16(enc) ? 2 : 1);
  if (pos >= data.length) return null;
  if (!desc.value.toLowerCase().includes('licen')) return null;
  return decodeText(data.subarray(pos), enc);
}

function parseCOMM(data) {
  if (data.length < 5) return null;
  const enc = data[0];
  const desc = decodeTerminated(data, 4, enc);
  const pos = 4 + desc.bytes + (isUtf16(enc) ? 2 : 1);
  if (pos >= data.length) return null;
  if (!desc.value.toLowerCase().includes('licen')) return null;
  return decodeText(data.subarray(pos), enc);
}

function detectFromID3v2(b) {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'ID3') return null;
  const major = b[3];
  const tagEnd = 10 + syncsafeInt(b, 6);
  if (tagEnd > b.length) return null;
  let off = 10;
  while (off + 10 <= tagEnd) {
    const frameId = b.toString('ascii', off, off + 4);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
    const frameSize = major === 4 ? syncsafeInt(b, off + 4) : b.readUInt32BE(off + 4);
    const dataStart = off + 10;
    if (frameSize <= 0 || dataStart + frameSize > b.length) break;
    const data = b.subarray(dataStart, dataStart + frameSize);
    let value = null;
    if (frameId === 'TXXX') value = parseTXXX(data);
    else if (frameId === 'TCOP') value = parseTextFrame(data);
    else if (frameId === 'COMM') value = parseCOMM(data);
    if (value) return value;
    off = dataStart + frameSize;
  }
  return null;
}

function detectFromVorbisComment(b) {
  let off = 0;
  if (off + 4 > b.length) return null;
  const vendorLen = b.readUInt32LE(off);
  off += 4 + vendorLen;
  if (off + 4 > b.length) return null;
  const count = b.readUInt32LE(off);
  off += 4;
  for (let i = 0; i < count && off + 4 <= b.length; i++) {
    const len = b.readUInt32LE(off);
    off += 4;
    if (off + len > b.length) return null;
    const comment = b.toString('utf8', off, off + len);
    off += len;
    const eq = comment.indexOf('=');
    if (eq > 0) {
      const key = comment.substring(0, eq).toUpperCase();
      if (key === 'LICENSE' || key.endsWith('LICENSE')) return comment.substring(eq + 1);
    }
  }
  return null;
}

function detectFromFlac(b) {
  if (b.length < 4 || b.toString('ascii', 0, 4) !== 'fLaC') return null;
  let off = 4;
  while (off + 4 <= b.length) {
    const header = b.readUInt32BE(off);
    const last = (header & 0x80000000) !== 0;
    const blockType = (header >> 24) & 0x7f;
    const blockLen = header & 0xffffff;
    off += 4;
    if (off + blockLen > b.length) return null;
    if (blockType === 4) return detectFromVorbisComment(b.subarray(off, off + blockLen));
    off += blockLen;
    if (last) break;
  }
  return null;
}

function detectFromGenericSearch(b) {
  const text = b.toString('latin1');
  const m = text.match(/LICENSE[= ]{1,3}([A-Za-z0-9 .\-+]{3,80})/i);
  return m ? m[1] : null;
}

function detectFromAudio(filePath, ext) {
  const b = readHead(filePath, MAX_HEAD_BYTES);
  if (!b) return null;
  if (ext === '.mp3') {
    return detectFromID3v2(b) || detectFromGenericSearch(b);
  }
  if (ext === '.flac') {
    return detectFromFlac(b);
  }
  if (ext === '.ogg' || ext === '.oga' || ext === '.opus') {
    return detectFromGenericSearch(b);
  }
  return null;
}

function cleanLicenseValue(value) {
  const v = (value || '').trim();
  if (!v || v.length > MAX_LICENSE_VALUE) return null;
  if (!/[A-Za-z]{2}/.test(v)) return null;
  return classifyLicense(v) || v;
}

function detectLicense(asset, libraryRoot) {
  if (!asset || !asset.file_path) return null;
  const fromFile = detectFromLicenseFile(path.dirname(asset.file_path), libraryRoot);
  if (fromFile) return { license: fromFile, source: 'file' };
  const ext = path.extname(asset.file_path).toLowerCase();
  const fromMetadata = cleanLicenseValue(detectFromAudio(asset.file_path, ext));
  if (fromMetadata) return { license: fromMetadata, source: 'metadata' };
  return null;
}

module.exports = { detectLicense };
