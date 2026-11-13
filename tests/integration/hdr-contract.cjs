"use strict";
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const { spawnSync, execFileSync } = require("node:child_process");
const [script, work] = process.argv.slice(2);
const at = (name) => path.join(work, name);
const native = (tool, args) => execFileSync(tool, args, { encoding: "utf8" }).trim();

function run(files, status) {
    const result = spawnSync("osascript", ["-l", "JavaScript", script, "--", "--headless", at("settings.json"), ...files.map(at)], { encoding: "utf8", timeout: 120000 });
    assert.ifError(result.error);
    assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
    return JSON.parse(result.stdout);
}

function visibleStamp(output, label) {
    const width = Number(native("vipsheader", ["-f", "width", output]));
    const height = Number(native("vipsheader", ["-f", "height", output]));
    const mask = at(`${label}-mask.v`), region = at(`${label}-region.v`);
    native("vips", ["crop", output, region, String(width - 280), String(height - 150), "280", "150"]);
    native("vips", ["relational_const", region, mask, "more", "220"]);
    const pixels = Number(native("vips", ["avg", mask])) / 255 * 280 * 150;
    assert.ok(pixels > 100, `white caption is visible in the bottom-right region: ${pixels}`);
}

const names = ["photo", "no-icc", "p3", "rotated-6", "rotated-8"];
const originals = names.map((name) => fs.readFileSync(at(`${name}.jpg`)));
const result = run(names.map((name) => `${name}.jpg`), 0);
assert.equal(result.state, "complete");
assert.equal(result.images.length, 5);
for (const image of result.images) {
    assert.equal(image.state, "saved");
    const index = names.findIndex((name) => at(`${name}.jpg`) === image.source);
    assert.ok(index >= 0, "the receipt identifies a requested source");
    const name = names[index], source = at(`${name}.jpg`);
    assert.equal(native("vipsheader", ["-f", "vips-loader", image.output]), "jpegload");
    assert.doesNotMatch(native("vipsheader", ["-a", image.output]), /gainmap-/u);
    assert.equal(fs.readFileSync(image.output).includes(Buffer.from("MPF\0")), false);
    assert.equal(native("vipsheader", ["-f", "width", image.output]), name.startsWith("rotated") ? "600" : "900");
    assert.equal(native("vipsheader", ["-f", "height", image.output]), name.startsWith("rotated") ? "900" : "600");
    assert.equal(native("exiftool", ["-s3", "-DateTimeOriginal", image.output]), "2026:11:13 01:02:03");
    assert.equal(native("exiftool", ["-s3", "-n", "-GPSLatitude", image.output]), "10");
    assert.equal(native("exiftool", ["-s3", "-n", "-GPSLongitude", image.output]), "20");
    assert.deepEqual(execFileSync("exiftool", ["-icc_profile", "-b", image.output]), execFileSync("exiftool", ["-icc_profile", "-b", source]), `ICC profile: ${name}`);
    assert.ok(Number(native("vips", ["max", source])) < 150, "unmarked source cannot satisfy the bright-caption check");
    visibleStamp(image.output, name);
    assert.deepEqual(fs.readFileSync(source), originals[index], "original bytes unchanged");
}
const damaged = run(["damaged.jpg"], 1);
assert.equal(damaged.rejected[0].code, "damaged");
assert.equal(damaged.images.length, 0);
const unsupported = run(["unmapped.png"], 1);
assert.equal(unsupported.rejected[0].code, "unsupported-content");
assert.deepEqual(unsupported.rejected[0].diagnostic, { loader: "gifload" });
assert.equal(unsupported.rejected[0].reason, "This file's content is not a supported still image; use JPEG, PNG, HEIC, TIFF, WebP or AVIF.");
process.stdout.write("HDR stamped copies are plain JPEGs with visible captions, preserved profiles/capture metadata and no gain map.\n");
