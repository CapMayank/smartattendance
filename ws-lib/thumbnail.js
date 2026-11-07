'use strict';

const sharp = require('sharp');

const MAX_DECODED_BYTES = 2 * 1024 * 1024;
// Base64 of MAX_DECODED_BYTES, plus slack for padding/whitespace.
const MAX_BASE64_LENGTH = Math.ceil((MAX_DECODED_BYTES * 4) / 3) + 8;
const MAX_INPUT_PIXELS = 40 * 1000 * 1000;
const THUMB_SIZE = 160;
const THUMB_QUALITY = 60;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// Returns a JPEG Buffer (longest side <= 160) or null. Never throws.
async function makeThumbnail(base64) {
  try {
    if (typeof base64 !== 'string') return null;
    // Check length BEFORE decoding so huge strings are never decoded.
    if (base64.length === 0 || base64.length > MAX_BASE64_LENGTH) return null;
    if (!BASE64_RE.test(base64)) return null;

    const buf = Buffer.from(base64, 'base64');
    if (buf.length < 4 || buf.length > MAX_DECODED_BYTES) return null;
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

    return await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch (e) {
    return null;
  }
}

module.exports = { makeThumbnail };
