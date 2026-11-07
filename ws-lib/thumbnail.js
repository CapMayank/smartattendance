'use strict';

// sharp is loaded lazily inside makeThumbnail so a missing native binary can never stop ws-server from starting.

const MAX_DECODED_BYTES = 2 * 1024 * 1024;
// Base64 of MAX_DECODED_BYTES, plus slack for padding/whitespace.
const MAX_BASE64_LENGTH = Math.ceil((MAX_DECODED_BYTES * 4) / 3) + 8;
const MAX_INPUT_PIXELS = 40 * 1000 * 1000;
const THUMB_SIZE = 400;
const THUMB_QUALITY = 75;
const SHARPEN_SIGMA = 0.6;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

// Returns a JPEG Buffer (longest side <= 400) or null. Never throws.
// `onReject(reason)` is called once per rejection with one of: not-a-string, empty, too-large,
// not-base64, not-jpeg, sharp-unavailable, sharp-failed. It never receives image data.
async function makeThumbnail(base64, onReject) {
  const reject = (reason) => {
    try {
      if (typeof onReject === 'function') onReject(reason);
    } catch {
      // A broken callback must not turn a rejection into a throw.
    }
    return null;
  };
  try {
    if (typeof base64 !== 'string') return reject('not-a-string');
    // Check length BEFORE decoding so huge strings are never decoded.
    if (base64.length === 0) return reject('empty');
    if (base64.length > MAX_BASE64_LENGTH) return reject('too-large');
    if (!BASE64_RE.test(base64)) return reject('not-base64');

    const buf = Buffer.from(base64, 'base64');
    if (buf.length > MAX_DECODED_BYTES) return reject('too-large');
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return reject('not-jpeg');

    let sharp;
    try {
      sharp = require('sharp');
    } catch {
      return reject('sharp-unavailable');
    }

    try {
      return await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
        // Gentle auto-contrast and a light sharpen so faces stay clear at 400 px.
        .normalise()
        .sharpen({ sigma: SHARPEN_SIGMA })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer();
    } catch {
      return reject('sharp-failed');
    }
  } catch {
    return reject('sharp-failed');
  }
}

module.exports = { makeThumbnail };
