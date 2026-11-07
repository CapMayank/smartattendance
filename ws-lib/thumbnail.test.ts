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
  it("resizes a 640x480 JPEG to longest side 160", async () => {
    const out = await makeThumbnail((await jpeg(640, 480)).toString("base64"));
    expect(Buffer.isBuffer(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(160);
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
