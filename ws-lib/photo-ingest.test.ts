import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createFakePrisma, type Fixtures } from "../src/test-utils/fake-prisma";

const require = createRequire(import.meta.url);
const { storePunchPhoto } = require("./photo-ingest.js");
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
