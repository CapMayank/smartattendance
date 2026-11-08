import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ingestPunchRecord } = require("./unmatched-ingest.js");

describe("ingestPunchRecord (ws-server punch ingestion)", () => {
  let mockPrisma: any;
  let photoItems: any[];
  let collectPhotoMock: any;

  beforeEach(() => {
    photoItems = [];
    collectPhotoMock = vi.fn();
    mockPrisma = {
      staff: {
        findUnique: vi.fn(),
      },
      attendanceLog: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: "log-1", ...data })),
      },
      unmatchedPunch: {
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: "unmatched-1", ...data })),
      },
    };
  });

  it("skips incomplete record without enrollid/pin or timestamp", async () => {
    const res = await ingestPunchRecord(mockPrisma, { enrollid: "" }, { photoItems, collectPhoto: collectPhotoMock });
    expect(res).toEqual({ status: "SKIPPED", reason: "INCOMPLETE" });
    expect(mockPrisma.unmatchedPunch.create).not.toHaveBeenCalled();
    expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled();
  });

  it("inserts UNKNOWN_ID into UnmatchedPunch when staff not found", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue(null);

    const record = {
      enrollid: "999",
      time: "2026-11-08 09:30:00",
      inout: "0",
      image: "base64image==",
    };

    const res = await ingestPunchRecord(mockPrisma, record, { photoItems, collectPhoto: collectPhotoMock });

    expect(res.status).toBe("UNMATCHED_UNKNOWN");
    expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
      where: { machineId: "999" },
      include: { employmentPeriods: true },
    });
    expect(mockPrisma.unmatchedPunch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        machineId: "999",
        timestamp: expect.any(Date),
        type: "IN",
        reason: "UNKNOWN_ID",
      }),
    });
    // Never create AttendanceLog and never collect photo for unmatched punches
    expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled();
    expect(collectPhotoMock).not.toHaveBeenCalled();
    expect(photoItems).toHaveLength(0);
  });

  it("sets type to OUT for unknown staff when inout is '1'", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue(null);

    const record = {
      enrollid: "888",
      time: "2026-11-08 17:00:00",
      inout: "1",
    };

    const res = await ingestPunchRecord(mockPrisma, record, { photoItems, collectPhoto: collectPhotoMock });
    expect(res.status).toBe("UNMATCHED_UNKNOWN");
    expect(mockPrisma.unmatchedPunch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        machineId: "888",
        type: "OUT",
        reason: "UNKNOWN_ID",
      }),
    });
  });

  it("inserts NOT_EMPLOYED into UnmatchedPunch when staff is not employed on punch date", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue({
      id: "staff-exited",
      name: "Old Employee",
      machineId: "202",
      employmentPeriods: [
        { startDate: "2026-01-01", endDate: "2026-06-30" },
      ],
    });

    const record = {
      enrollid: "202",
      time: "2026-11-08 10:00:00",
      inout: "0",
      image: "photo-data",
    };

    const res = await ingestPunchRecord(mockPrisma, record, { photoItems, collectPhoto: collectPhotoMock });

    expect(res.status).toBe("UNMATCHED_NOT_EMPLOYED");
    expect(mockPrisma.unmatchedPunch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        machineId: "202",
        timestamp: expect.any(Date),
        type: "IN",
        reason: "NOT_EMPLOYED",
        attachedStaffId: "staff-exited",
      }),
    });
    expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled();
    expect(collectPhotoMock).not.toHaveBeenCalled();
  });

  it("creates AttendanceLog and collects photo for active employed staff", async () => {
    const staff = {
      id: "staff-active",
      name: "Active Teacher",
      machineId: "101",
      employmentPeriods: [
        { startDate: "2026-01-01", endDate: null },
      ],
    };
    mockPrisma.staff.findUnique.mockResolvedValue(staff);

    const record = {
      enrollid: "101",
      time: "2026-11-08 08:45:00",
      inout: "0",
      image: "valid-photo",
    };

    const res = await ingestPunchRecord(mockPrisma, record, { photoItems, collectPhoto: collectPhotoMock });

    expect(res.status).toBe("SAVED");
    expect(mockPrisma.unmatchedPunch.create).not.toHaveBeenCalled();
    expect(mockPrisma.attendanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        staffId: "staff-active",
        type: "IN",
      }),
    });
    expect(collectPhotoMock).toHaveBeenCalledWith(photoItems, expect.objectContaining({
      staff,
      image: "valid-photo",
    }));
  });

  it("creates AttendanceLog for legacy staff with empty employment periods", async () => {
    const staff = {
      id: "staff-legacy",
      name: "Legacy Teacher",
      machineId: "105",
      employmentPeriods: [],
    };
    mockPrisma.staff.findUnique.mockResolvedValue(staff);

    const record = {
      enrollid: "105",
      time: "2026-11-08 08:45:00",
      inout: "0",
    };

    const res = await ingestPunchRecord(mockPrisma, record, { photoItems, collectPhoto: collectPhotoMock });

    expect(res.status).toBe("SAVED");
    expect(mockPrisma.attendanceLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        staffId: "staff-legacy",
        type: "IN",
      }),
    });
  });
});
