import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { makeThumbnail } = require("./thumbnail.js");

async function jpeg(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#3366cc" } })
    .jpeg()
    .toBuffer();
}

describe("makeThumbnail", () => {
  it("resizes a 640x480 JPEG to longest side 400", async () => {
    const out = await makeThumbnail((await jpeg(640, 480)).toString("base64"));
    expect(Buffer.isBuffer(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(400);
    expect(Math.min(meta.width!, meta.height!)).toBe(300);
  });

  it("resizes a portrait 480x1200 JPEG to longest side 400", async () => {
    const meta = await sharp(await makeThumbnail((await jpeg(480, 1200)).toString("base64"))).metadata();
    expect(meta.height).toBe(400);
    expect(meta.width).toBe(160);
  });

  it("keeps a 300x200 JPEG at its own size (no enlargement up to 400)", async () => {
    const meta = await sharp(await makeThumbnail((await jpeg(300, 200)).toString("base64"))).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("stretches a low-contrast image with auto-contrast", async () => {
    // Horizontal grey ramp from 100 to 150: a dull, low-contrast picture
    const width = 200;
    const height = 100;
    const raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = 100 + Math.round((50 * x) / (width - 1));
        raw.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
    const input = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
    const before = (await sharp(input).stats()).channels[0];
    const out = await makeThumbnail(input.toString("base64"));
    expect(Buffer.isBuffer(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(400);
    expect(meta.width).toBe(width);
    const after = (await sharp(out).stats()).channels[0];
    expect(before.max - before.min).toBeLessThan(60);
    expect(after.max - after.min).toBeGreaterThan(before.max - before.min + 100);
  });

  it("drops metadata from the output", async () => {
    const withExif = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#3366cc" } })
      .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const meta = await sharp(await makeThumbnail(withExif.toString("base64"))).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("does not enlarge small images", async () => {
    const out = await makeThumbnail((await jpeg(50, 40)).toString("base64"));
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(50);
  });

  it("rejects a PNG", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await makeThumbnail(png.toString("base64"))).toBeNull();
  });

  it("rejects non-base64, empty and non-string input", async () => {
    expect(await makeThumbnail("!!!not base64***")).toBeNull();
    expect(await makeThumbnail("")).toBeNull();
    expect(await makeThumbnail(undefined)).toBeNull();
    expect(await makeThumbnail(null)).toBeNull();
    expect(await makeThumbnail(42)).toBeNull();
    expect(await makeThumbnail(["/9j/"])).toBeNull();
    expect(await makeThumbnail({})).toBeNull();
  });

  it("rejects objects with a throwing toString", async () => {
    const evil = { toString() { throw new Error("boom"); } };
    expect(await makeThumbnail(evil)).toBeNull();
    expect(await makeThumbnail(new Proxy({}, { get() { throw new Error("x"); } }))).toBeNull();
  });

  it("rejects a JPEG larger than 2 MB decoded", async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024 + 1)]);
    expect(await makeThumbnail(big.toString("base64"))).toBeNull();
  });

  it("rejects an enormous string without decoding it", async () => {
    const huge = "/9j/".repeat(50 * 1024 * 1024 / 4); // 50 MB of base64
    const t = Date.now();
    expect(await makeThumbnail(huge)).toBeNull();
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it("returns null for a truncated JPEG", async () => {
    const full = await jpeg(640, 480);
    expect(await makeThumbnail(full.subarray(0, 40).toString("base64"))).toBeNull();
  });

  it("returns null for JPEG magic followed by garbage", async () => {
    const junk = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("garbage garbage garbage")]);
    expect(await makeThumbnail(junk.toString("base64"))).toBeNull();
  });

  it("returns null for a JPEG with absurd dimensions", async () => {
    // 8000x8000 = 64 MP of a flat colour compresses to a tiny file
    const bomb = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#000" } })
      .jpeg({ quality: 1 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(2 * 1024 * 1024);
    expect(await makeThumbnail(bomb.toString("base64"))).toBeNull();
  });
});

describe("makeThumbnail rejection reasons", () => {
  async function reasonFor(input: unknown) {
    const reasons: string[] = [];
    const out = await makeThumbnail(input, (r: string) => reasons.push(r));
    expect(out).toBeNull();
    return reasons;
  }

  it("reports one reason per rejection", async () => {
    expect(await reasonFor(42)).toEqual(["not-a-string"]);
    expect(await reasonFor(undefined)).toEqual(["not-a-string"]);
    expect(await reasonFor("")).toEqual(["empty"]);
    expect(await reasonFor("/9j/".repeat(1024 * 1024))).toEqual(["too-large"]);
    expect(await reasonFor("!!!not base64***")).toEqual(["not-base64"]);
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await reasonFor(png.toString("base64"))).toEqual(["not-jpeg"]);
    const junk = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("garbage garbage garbage")]);
    expect(await reasonFor(junk.toString("base64"))).toEqual(["sharp-failed"]);
  });

  it("reports nothing for a good JPEG", async () => {
    const reasons: string[] = [];
    const out = await makeThumbnail((await jpeg(64, 48)).toString("base64"), (r: string) => reasons.push(r));
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(reasons).toEqual([]);
  });

  it("survives a throwing callback", async () => {
    const out = await makeThumbnail(42, () => {
      throw new Error("callback broke");
    });
    expect(out).toBeNull();
  });
});
