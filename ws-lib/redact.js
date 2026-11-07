'use strict';

const MAX_STRING = 200;
const MAX_RECORDS = 10;

function safeStr(v) {
  try {
    return String(v);
  } catch (e) {
    return '<unprintable>';
  }
}

function redactForLog(value) {
  try {
    if (typeof value === 'string') {
      return value.length > MAX_STRING ? `<redacted ${value.length} chars>` : value;
    }
    if (Array.isArray(value)) return value.map(redactForLog);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        const v = value[key];
        if (key === 'image' && v !== null && v !== undefined) {
          out[key] = `<redacted ${typeof v === 'string' ? v.length : safeStr(v).length} chars>`;
        } else {
          out[key] = redactForLog(v);
        }
      }
      return out;
    }
    return value;
  } catch (e) {
    return '<unprintable>';
  }
}

function clip(value, max = 80) {
  const s = safeStr(value).replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… (+${s.length - max} chars)`;
}

// JSON for logging an object whose string values are clipped.
function clipJson(obj, max = 80) {
  try {
    return JSON.stringify(obj, (k, v) => (typeof v === 'string' ? clip(v, max) : v));
  } catch (e) {
    return '<unprintable>';
  }
}

function summarizeMessage(data) {
  const d = data && typeof data === 'object' ? data : {};
  const parts = [`cmd ${clip(d.cmd !== undefined ? d.cmd : d.ret !== undefined ? d.ret : 'unknown', 40)}`];
  if (d.sn !== undefined) parts.push(`sn ${clip(d.sn, 40)}`);
  if (d.count !== undefined) parts.push(`count ${clip(d.count, 20)}`);
  if (Array.isArray(d.record)) {
    const recs = d.record.slice(0, MAX_RECORDS).map((r) => {
      const rec = r && typeof r === 'object' ? r : {};
      return `enrollid ${clip(rec.enrollid, 20)} at ${clip(rec.time, 30)}`;
    });
    if (d.record.length > MAX_RECORDS) recs.push(`+${d.record.length - MAX_RECORDS} more`);
    parts.push(`records [${recs.join('; ')}]`);
  }
  return parts.join(' ');
}

module.exports = { redactForLog, summarizeMessage, clip, clipJson, safeStr };
