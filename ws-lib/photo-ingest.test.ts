import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createFakePrisma, type Fixtures } from "../src/test-utils/fake-prisma";

const require = createRequire(import.meta.url);
const { storePunchPhoto, processPhotosAfterAck, collectPhoto, logRejection, resetRejectionLog } = require("./photo-ingest.js");
const thumbnail = require("./thumbnail.js");

const T1 = new Date("2026-11-07T03:00:00Z");
const T2 = new Date("2026-11-07T09:00:00Z");

let image = "";
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  image = (
    await sharp({ create: { width: 320, height: 240, channels: 3, background: "#3366cc" } })
      .jpeg()
      .toBuffer()
  ).toString("base64");
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetRejectionLog();
});

function setup(staffExtra: { profilePhotoId?: string | null; profilePhotoPinned?: boolean } = {}) {
  const fixtures: Fixtures = {
    staff: [{ id: "s1", name: "Asha", shiftId: null, shift: null, ...staffExtra }],
    policy: null,
    holidays: [],
    lockedPayrolls: [],
    logs: [],
  };
  const fake = createFakePrisma(fixtures);
  const staffRow = () => (fake.client as { staff: { findUnique: (a: unknown) => Promise<Record<string, unknown>> } })
    .staff.findUnique({ where: { id: "s1" } });
  return { fake, prisma: fake.client, staffRow };
}

const staffArg = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  profilePhotoId: null,
  profilePhotoPinned: false,
  ...extra,
});

describe("storePunchPhoto", () => {
  it("stores one photo and sets the profile for an unpinned teacher", async () => {
    const { fake, prisma, staffRow } = setup();
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });

    const punch = fake.punchPhotos.filter((p) => !p.isProfile);
    const profile = fake.punchPhotos.filter((p) => p.isProfile);
    expect(punch).toHaveLength(1);
    expect(punch[0]).toMatchObject({ staffId: "s1", logId: "l1", takenAt: T1 });
    expect(Buffer.isBuffer(punch[0].data)).toBe(true);
    expect(profile).toHaveLength(1);
    expect(profile[0].logId ?? null).toBeNull();
    expect(profile[0].takenAt).toEqual(T1);
    expect((await staffRow()).profilePhotoId).toBe(profile[0].id);
  });

  it("a later punch replaces the automatic profile copy and deletes the old one", async () => {
    const { fake, prisma, staffRow } = setup();
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });
    const first = fake.punchPhotos.find((p) => p.isProfile)!;
    // Pass the stale staff object on purpose; the function must re-read the row.
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l2", timestamp: T2 }, image });

    const profile = fake.punchPhotos.filter((p) => p.isProfile);
    expect(profile).toHaveLength(1);
    expect(profile[0].id).not.toBe(first.id);
    expect(profile[0].takenAt).toEqual(T2);
    expect((await staffRow()).profilePhotoId).toBe(profile[0].id);
    expect(fake.punchPhotos.filter((p) => !p.isProfile)).toHaveLength(2);
  });

  it("a second call with the same log id adds nothing", async () => {
    const { fake, prisma, staffRow } = setup();
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });
    const pointer = (await staffRow()).profilePhotoId;
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });

    expect(fake.punchPhotos.filter((p) => !p.isProfile)).toHaveLength(1);
    expect(fake.punchPhotos.filter((p) => p.isProfile)).toHaveLength(1);
    expect((await staffRow()).profilePhotoId).toBe(pointer);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("an older punch leaves the profile alone but still stores the punch photo", async () => {
    const { fake, prisma, staffRow } = setup();
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l2", timestamp: T2 }, image });
    const pointer = (await staffRow()).profilePhotoId;
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });

    expect(fake.punchPhotos.filter((p) => !p.isProfile)).toHaveLength(2);
    const profile = fake.punchPhotos.filter((p) => p.isProfile);
    expect(profile).toHaveLength(1);
    expect(profile[0].takenAt).toEqual(T2);
    expect((await staffRow()).profilePhotoId).toBe(pointer);
  });

  it("a pinned teacher keeps their profile", async () => {
    const { fake, prisma, staffRow } = setup({ profilePhotoId: "pinned-1", profilePhotoPinned: true });
    fake.punchPhotos.push({ id: "pinned-1", staffId: "s1", logId: null, takenAt: T1, data: Buffer.from("x"), isProfile: true });
    await storePunchPhoto(prisma, {
      staff: staffArg({ profilePhotoId: "pinned-1", profilePhotoPinned: true }),
      log: { id: "l2", timestamp: T2 },
      image,
    });

    expect((await staffRow()).profilePhotoId).toBe("pinned-1");
    expect(fake.punchPhotos.filter((p) => p.isProfile).map((p) => p.id)).toEqual(["pinned-1"]);
    expect(fake.punchPhotos.filter((p) => !p.isProfile)).toHaveLength(1);
  });

  it("respects a pin even when the passed-in staff object is stale", async () => {
    const { fake, prisma, staffRow } = setup({ profilePhotoId: "pinned-1", profilePhotoPinned: true });
    fake.punchPhotos.push({ id: "pinned-1", staffId: "s1", logId: null, takenAt: T1, data: Buffer.from("x"), isProfile: true });
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l2", timestamp: T2 }, image });

    expect((await staffRow()).profilePhotoId).toBe("pinned-1");
    expect(fake.punchPhotos.filter((p) => p.isProfile).map((p) => p.id)).toEqual(["pinned-1"]);
  });

  it("never deletes a previous profile target that is not an isProfile row", async () => {
    const { fake, prisma, staffRow } = setup({ profilePhotoId: "plain-1" });
    fake.punchPhotos.push({ id: "plain-1", staffId: "s1", logId: "l0", takenAt: T1, data: Buffer.from("x"), isProfile: false });
    await storePunchPhoto(prisma, { staff: staffArg({ profilePhotoId: "plain-1" }), log: { id: "l2", timestamp: T2 }, image });

    expect(fake.punchPhotos.some((p) => p.id === "plain-1")).toBe(true);
    const profile = fake.punchPhotos.filter((p) => p.isProfile);
    expect(profile).toHaveLength(1);
    expect((await staffRow()).profilePhotoId).toBe(profile[0].id);
  });

  it("a thrown punchPhoto.create resolves without throwing and logs only the message", async () => {
    const { fake, prisma } = setup();
    (prisma as { punchPhoto: { create: unknown } }).punchPhoto.create = async () => {
      throw new Error("db down");
    };
    await expect(
      storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image }),
    ).resolves.toBeUndefined();
    expect(fake.punchPhotos).toHaveLength(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0][0]);
    expect(line).toBe("[photo] ingest failed: db down");
    expect(logSpy.mock.calls[0]).toHaveLength(1);
  });

  it("a failure in the profile step leaves the punch photo and a valid pointer", async () => {
    const { fake, prisma, staffRow } = setup();
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });
    const pointer = (await staffRow()).profilePhotoId;
    const p = prisma as { staff: { updateMany: unknown } };
    p.staff.updateMany = async () => {
      throw new Error("update failed");
    };
    await expect(
      storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l2", timestamp: T2 }, image }),
    ).resolves.toBeUndefined();

    expect(fake.punchPhotos.filter((x) => !x.isProfile)).toHaveLength(2);
    const profile = fake.punchPhotos.filter((x) => x.isProfile);
    expect(profile).toHaveLength(1);
    expect(profile[0].id).toBe(pointer);
    expect((await staffRow()).profilePhotoId).toBe(pointer);
    expect(String(logSpy.mock.calls[0][0])).toBe("[photo] ingest failed: update failed");
  });

  it("handles a P2002 from the database as a redelivery", async () => {
    const { fake, prisma, staffRow } = setup();
    (prisma as { punchPhoto: { create: unknown } }).punchPhoto.create = async () => {
      throw Object.assign(new Error("Unique constraint failed on the fields: (`logId`)"), { code: "P2002" });
    };
    await expect(
      storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image }),
    ).resolves.toBeUndefined();
    expect(fake.punchPhotos).toHaveLength(0);
    expect((await staffRow()).profilePhotoId ?? null).toBeNull();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("a thumbnail failure resolves without storing anything", async () => {
    vi.spyOn(thumbnail, "makeThumbnail").mockRejectedValue(new Error("sharp exploded"));
    const { fake, prisma } = setup();
    await expect(
      storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image }),
    ).resolves.toBeUndefined();
    expect(fake.punchPhotos).toHaveLength(0);
    expect(String(logSpy.mock.calls[0][0])).toBe("[photo] ingest failed: sharp exploded");
  });

  it("an invalid image stores nothing", async () => {
    const { fake, prisma, staffRow } = setup();
    for (const bad of [undefined, "", "not base64!", Buffer.from("PNGdata").toString("base64")]) {
      await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image: bad });
    }
    expect(fake.punchPhotos).toHaveLength(0);
    expect((await staffRow()).profilePhotoId ?? null).toBeNull();
  });

  it("never logs the image or long strings", async () => {
    const { prisma } = setup();
    (prisma as { punchPhoto: { create: unknown } }).punchPhoto.create = async () => {
      throw new Error("x".repeat(500) + image);
    };
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image });
    const line = String(logSpy.mock.calls[0][0]);
    expect(line.length).toBeLessThan(200);
    expect(line).not.toContain(image.slice(0, 40));
  });
});

describe("thumbnail rejection logging", () => {
  it("logs one clipped line per reason, at most once per 5 minutes per reason", () => {
    let now = 1_000_000;
    const clock = () => now;
    logRejection("not-jpeg", clock);
    logRejection("not-jpeg", clock);
    logRejection("too-large", clock);
    expect(logSpy.mock.calls.map((c) => c[0])).toEqual([
      "[photo] thumbnail rejected: not-jpeg",
      "[photo] thumbnail rejected: too-large",
    ]);
    now += 5 * 60 * 1000 - 1;
    logRejection("not-jpeg", clock);
    expect(logSpy).toHaveBeenCalledTimes(2);
    now += 1;
    logRejection("not-jpeg", clock);
    expect(logSpy).toHaveBeenCalledTimes(3);
    for (const c of logSpy.mock.calls) expect(c).toHaveLength(1);
  });

  it("clips an unexpected reason", () => {
    logRejection("r".repeat(500), () => 0);
    expect(String(logSpy.mock.calls[0][0]).length).toBeLessThan(120);
  });

  it("storePunchPhoto logs the rejection reason once and never the image", async () => {
    const { prisma } = setup();
    const png = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).png().toBuffer()).toString("base64");
    const clock = () => 42;
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l1", timestamp: T1 }, image: png }, { now: clock });
    await storePunchPhoto(prisma, { staff: staffArg(), log: { id: "l2", timestamp: T1 }, image: png }, { now: clock });
    expect(logSpy.mock.calls.map((c) => c[0])).toEqual(["[photo] thumbnail rejected: not-jpeg"]);
  });
});

describe("collectPhoto", () => {
  it("keeps only records with a non-empty string image", () => {
    const items: unknown[] = [];
    const staff = staffArg();
    const log = { id: "l1", timestamp: T1 };
    for (const img of [undefined, null, "", 42, { a: 1 }]) collectPhoto(items, { staff, log, image: img });
    expect(items).toHaveLength(0);
    collectPhoto(items, { staff, log, image: "abc" });
    expect(items).toEqual([{ staff, log, image: "abc" }]);
  });
});

describe("processPhotosAfterAck", () => {
  it("runs after the caller sent the ACK, sequentially and in order", async () => {
    const events: string[] = [];
    const items = [1, 2, 3].map((n) => ({ staff: staffArg(), log: { id: `l${n}`, timestamp: T1 }, image: `img${n}` }));
    let active = 0;
    const store = async (_p: unknown, item: { log: { id: string } }) => {
      active++;
      expect(active).toBe(1);
      events.push(`start ${item.log.id}`);
      await new Promise((r) => setTimeout(r, 5));
      events.push(`end ${item.log.id}`);
      active--;
    };
    // The caller pattern in ws-server.js: send the ACK, then process the collected photos.
    const ws = { send: (msg: string) => events.push(`ack ${msg}`) };
    ws.send("sendlog");
    await processPhotosAfterAck({}, items, store);
    expect(events).toEqual([
      "ack sendlog",
      "start l1", "end l1",
      "start l2", "end l2",
      "start l3", "end l3",
    ]);
  });

  it("isolates failures: a throwing or rejecting item never stops the rest or throws", async () => {
    const seen: string[] = [];
    const store = async (_p: unknown, item: { log: { id: string } }) => {
      seen.push(item.log.id);
      if (item.log.id === "l1") throw new Error("boom");
      if (item.log.id === "l2") return Promise.reject(new Error("nope"));
    };
    const items = ["l1", "l2", "l3"].map((id) => ({ staff: staffArg(), log: { id, timestamp: T1 }, image: "x" }));
    await expect(processPhotosAfterAck({}, items, store)).resolves.toBeUndefined();
    expect(seen).toEqual(["l1", "l2", "l3"]);
    for (const c of logSpy.mock.calls) expect(String(c[0])).toMatch(/^\[photo\] ingest failed: /);
  });

  it("tolerates a missing or non-array item list", async () => {
    await expect(processPhotosAfterAck({}, undefined)).resolves.toBeUndefined();
    await expect(processPhotosAfterAck({}, null)).resolves.toBeUndefined();
  });

  it("stores real photos through storePunchPhoto by default", async () => {
    const { fake, prisma } = setup();
    await processPhotosAfterAck(prisma, [{ staff: staffArg(), log: { id: "l1", timestamp: T1 }, image }]);
    expect(fake.punchPhotos.filter((p) => !p.isProfile)).toHaveLength(1);
  });
});
