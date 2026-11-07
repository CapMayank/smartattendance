'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS module loaded by ws-server.js under pm2 */

const thumbnail = require('./thumbnail');
const { clip } = require('./redact');

const isUniqueViolation = (e) => Boolean(e && e.code === 'P2002');

// Stores the punch photo for a saved AttendanceLog and, for an unpinned teacher, moves the
// profile picture forward to it. Runs after the punch is saved; never throws.
async function storePunchPhoto(prisma, { staff, log, image } = {}) {
  try {
    // Called through the module object so tests can replace it.
    const data = await thumbnail.makeThumbnail(image);
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

module.exports = { storePunchPhoto };
