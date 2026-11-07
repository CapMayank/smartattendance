'use strict';

const MAX_STRING = 200;

function redactForLog(value) {
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `<redacted ${value.length} chars>` : value;
  }
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (key === 'image' && v !== null && v !== undefined) {
        out[key] = `<redacted ${String(v).length} chars>`;
      } else {
        out[key] = redactForLog(v);
      }
    }
    return out;
  }
  return value;
}

function summarizeMessage(data) {
  const d = data && typeof data === 'object' ? data : {};
  const parts = [`cmd ${redactForLog(String(d.cmd ?? d.ret ?? 'unknown'))}`];
  if (d.sn !== undefined) parts.push(`sn ${redactForLog(String(d.sn))}`);
  if (d.count !== undefined) parts.push(`count ${redactForLog(String(d.count))}`);
  if (Array.isArray(d.record)) {
    const recs = d.record.map(
      (r) => `enrollid ${redactForLog(String(r && r.enrollid))} at ${redactForLog(String(r && r.time))}`
    );
    parts.push(`records [${recs.join('; ')}]`);
  }
  return `${parts.join(' ')}`.replace(/[\r\n]+/g, ' ');
}

module.exports = { redactForLog, summarizeMessage };
