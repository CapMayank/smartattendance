'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS module loaded by ws-server.js under pm2 */

const thumbnail = require('./thumbnail');
const { clip } = require('./redact');

const isUniqueViolation = (e) => Boolean(e && e.code === 'P2002');

const REJECTION_LOG_INTERVAL_MS = 5 * 60 * 1000;
// reason -> last time it was logged (ms). Module-level so the limit spans messages.
const rejectionLoggedAt = new Map();

// Logs one clipped line per thumbnail rejection reason, at most once per 5 minutes per reason.
function logRejection(reason, now = Date.now) {
  try {
    const key = clip(reason, 40);
    const t = now();
    const last = rejectionLoggedAt.get(key);
    if (last !== undefined && t - last < REJECTION_LOG_INTERVAL_MS) return;
    rejectionLoggedAt.set(key, t);
    console.log(`[photo] thumbnail rejected: ${key}`);
  } catch {
    // Logging must never affect ingest.
  }
}

function resetRejectionLog() {
  rejectionLoggedAt.clear();
}

// Stores the punch photo for a saved AttendanceLog and, for an unpinned teacher, moves the
// profile picture forward to it. Runs after the punch is saved; never throws.
async function storePunchPhoto(prisma, { staff, log, image } = {}, { now = Date.now } = {}) {
  try {
    // Called through the module object so tests can replace it.
    const data = await thumbnail.makeThumbnail(image, (reason) => logRejection(reason, now));
    if (!data) return;

    const staffId = staff.id;
    const takenAt = new Date(log.timestamp);
    if (Number.isNaN(takenAt.getTime())) throw new Error('invalid punch timestamp');

    try {
      await prisma.punchPhoto.create({ data: { staffId, logId: log.id, takenAt, data } });
    } catch (e) {
      // Redelivery of a log we already have: the photo exists, and so does its profile step.
      if (isUniqueViolation(e)) return;
      throw e;
    }

    // One transaction: if any step fails, the copy is rolled back and the pointer stays on
    // the previous (still existing) row.
    await prisma.$transaction(async (tx) => {
      // Re-read: the caller's staff row may predate a pin an admin set moments ago.
      const current = await tx.staff.findUnique({
        where: { id: staffId },
        select: { profilePhotoId: true, profilePhotoPinned: true },
      });
      if (!current || current.profilePhotoPinned) return;

      const previousId = current.profilePhotoId || null;
      const previous = previousId
        ? await tx.punchPhoto.findUnique({
            where: { id: previousId },
            select: { id: true, staffId: true, takenAt: true, isProfile: true },
          })
        : null;
      // The profile only moves forward; an offline backfill never replaces a newer photo.
      if (previous && new Date(previous.takenAt).getTime() > takenAt.getTime()) return;

      const copy = await tx.punchPhoto.create({
        data: { staffId, takenAt, data, isProfile: true },
        select: { id: true },
      });

      // Compare-and-set on the pointer we read, so a concurrent pin or ingest is not
      // overwritten; losing the race rolls the copy back instead of leaving an orphan.
      const moved = await tx.staff.updateMany({
        where: { id: staffId, profilePhotoPinned: false, profilePhotoId: previousId },
        data: { profilePhotoId: copy.id },
      });
      if (moved.count !== 1) throw new Error('profile photo changed concurrently');

      // Only after the pointer moved, and only an automatic copy; never a plain punch photo.
      if (previous && previous.isProfile && previous.staffId === staffId) {
        await tx.punchPhoto.delete({ where: { id: previous.id } });
      }
    });
  } catch (e) {
    console.log(`[photo] ingest failed: ${clip(e && e.message)}`);
  }
}

// Queues a saved punch's photo for processing after the ACK; only non-empty string images.
function collectPhoto(items, { staff, log, image } = {}) {
  try {
    if (typeof image === 'string' && image.length > 0) items.push({ staff, log, image });
  } catch {
    // Never let photo bookkeeping affect the punch loop.
  }
}

// Called by ws-server.js only AFTER it has sent the ACK, so a slow or failing photo can never
// delay or alter it. Processes items one at a time, in order; never throws.
async function processPhotosAfterAck(prisma, items, store = storePunchPhoto) {
  try {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      try {
        await store(prisma, item);
      } catch (e) {
        console.log(`[photo] ingest failed: ${clip(e && e.message)}`);
      }
    }
  } catch (e) {
    console.log(`[photo] ingest failed: ${clip(e && e.message)}`);
  }
}

module.exports = { storePunchPhoto, processPhotosAfterAck, collectPhoto, logRejection, resetRejectionLog };
