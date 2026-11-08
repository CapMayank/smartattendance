const { isEmployedOnDate, istDateKey } = require('./employment');

function parsePunchTime(timestampStr) {
  if (timestampStr instanceof Date) {
    return timestampStr;
  }
  let punchTime = new Date();
  try {
    const cleanTimeStr = String(timestampStr).replace(' ', 'T') + '+05:30';
    const parsedTime = new Date(cleanTimeStr);
    if (!isNaN(parsedTime.getTime())) {
      punchTime = parsedTime;
    }
  } catch (_e) {
    // fallback to current punchTime
  }
  return punchTime;
}

function resolvePunchType(record) {
  if (record.inout === '1' || record.inout === 1) return 'OUT';
  if (record.inout === '0' || record.inout === 0) return 'IN';
  if (record.logtype === 1 || record.status === 1 || record.type === 'OUT') return 'OUT';
  return 'IN';
}

async function ingestPunchRecord(prisma, record, { photoItems = [], collectPhoto = null } = {}) {
  const machineUserId = String(record.enrollid || record.pin || record.user_id || record.userid || '');
  const timestampStr = record.verifytime || record.time || record.timestamp || record.datetime;

  if (!machineUserId || !timestampStr) {
    return { status: 'SKIPPED', reason: 'INCOMPLETE' };
  }

  const punchTime = parsePunchTime(timestampStr);
  const punchType = resolvePunchType(record);

  // Look up staff by machineId including employmentPeriods
  const staff = await prisma.staff.findUnique({
    where: { machineId: machineUserId },
    include: { employmentPeriods: true },
  });

  // Case A: Unknown ID
  if (!staff) {
    const unmatched = await prisma.unmatchedPunch.create({
      data: {
        machineId: machineUserId,
        timestamp: punchTime,
        type: punchType,
        reason: 'UNKNOWN_ID',
      },
    });
    return { status: 'UNMATCHED_UNKNOWN', unmatchedPunch: unmatched };
  }

  // Case B: Not Employed on punch date
  const punchDateKey = istDateKey(punchTime);
  const employed = isEmployedOnDate(staff, punchDateKey);
  if (!employed) {
    const unmatched = await prisma.unmatchedPunch.create({
      data: {
        machineId: machineUserId,
        timestamp: punchTime,
        type: punchType,
        reason: 'NOT_EMPLOYED',
        attachedStaffId: staff.id,
      },
    });
    return { status: 'UNMATCHED_NOT_EMPLOYED', unmatchedPunch: unmatched };
  }

  // Case C: Active / Employed Staff or Legacy Staff
  let type = punchType;
  if (type !== 'OUT') {
    const todayStart = new Date(punchTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(punchTime);
    todayEnd.setHours(23, 59, 59, 999);

    const existingCount = await prisma.attendanceLog.count({
      where: {
        staffId: staff.id,
        timestamp: { gte: todayStart, lte: todayEnd },
      },
    });

    if (existingCount % 2 === 1) {
      type = 'OUT';
    }
  }

  const log = await prisma.attendanceLog.create({
    data: {
      staffId: staff.id,
      timestamp: punchTime,
      type: type,
    },
  });

  if (collectPhoto && typeof collectPhoto === 'function') {
    collectPhoto(photoItems, { staff, log, image: record.image });
  }

  return { status: 'SAVED', staff, log, punchTime, type };
}

module.exports = {
  ingestPunchRecord,
  parsePunchTime,
  resolvePunchType,
};
