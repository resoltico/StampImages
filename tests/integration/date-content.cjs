"use strict";
const { parseReceipt } = require("./lib/receipt.cjs");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const [artifact, work, original, settingsPath] = process.argv.slice(2);
fs.mkdirSync(work, { recursive: true });
const settings = { ...JSON.parse(fs.readFileSync(settingsPath, "utf8")), dateFormat: "iso-minutes", coordinateFormat: "none", customText: "Caption" };
const hash = (filename) => crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
const run = (tool, args) => execFileSync(tool, args, { stdio: ["ignore", "pipe", "pipe"] });

function stamp(name, fields, config, expectedStatus) {
    const file = path.join(work, `${name}.json`), source = path.join(work, `${name}.png`);
    fs.copyFileSync(original, source);
    run("exiftool", ["-overwrite_original", "-DateTimeOriginal=", "-CreateDate=", source]);
    if (Object.keys(fields).length) { run("exiftool", ["-overwrite_original", ...Object.entries(fields).map(([key, value]) => `-${key}#=${value}`), source]); }
    fs.writeFileSync(file, JSON.stringify(config));
    const before = hash(source);
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", artifact, "--", "--headless", file, source], { encoding: "utf8", timeout: 30000, killSignal: "SIGKILL" });
    assert.ifError(result.error); assert.equal(result.status, expectedStatus, `${result.stdout}\n${result.stderr}`);
    assert.equal(hash(source), before);
    const receipt = parseReceipt(result.stdout); assert.equal(receipt.images.length, 1);
    return { record: receipt.images[0], stderr: result.stderr };
}

function samePixels(actual, expected) {
    const absolute = path.join(work, "absolute.v"), difference = path.join(work, "difference.v");
    run("vips", ["subtract", actual, expected, difference]); run("vips", ["abs", difference, absolute]);
    assert.equal(Number(run("vips", ["max", absolute]).toString().trim().split(/\s+/u)[0]), 0, "invalid/absent dates cannot add stamp pixels");
}

const caption = stamp("caption-only", {}, { ...settings, dateFormat: "none" }, 0).record.output;
for (const [name, value, invalid] of [
    ["zero", "0000:00:00 00:00:00", false], ["blank", "    :  :     :  :  ", false],
    ["year0", "0000:01:01 12:00:00", true], ["feb30", "2026:02:30 12:00:00", true]
]) {
    const result = stamp(name, { DateTimeOriginal: value }, settings, 1);
    assert.equal(result.record.state, "saved"); assert.deepEqual(result.record.missingMetadata, ["date/time"]);
    assert.deepEqual(result.record.invalidMetadata, invalid ? ["date/time"] : undefined);
    assert.equal(result.stderr.includes("Missing requested metadata: date/time."), !invalid);
    assert.equal(result.stderr.includes("Recorded but not valid, so left off: date/time."), invalid);
    samePixels(result.record.output, caption);
}
const valid = "2023:01:02 03:04:05";
const secondary = stamp("secondary", { CreateDate: valid }, settings, 0);
const fallback = stamp("fallback", { DateTimeOriginal: "2026:02:30 12:00:00", CreateDate: valid }, settings, 0);
assert.deepEqual(fallback.record.missingMetadata, []); assert.equal(fallback.record.invalidMetadata, undefined);
samePixels(fallback.record.output, secondary.record.output);
const noCaption = stamp("year0-only", { DateTimeOriginal: "0000:01:01 12:00:00" }, { ...settings, customText: "" }, 1);
assert.equal(noCaption.record.state, "nothing-to-stamp"); assert.equal(Object.hasOwn(noCaption.record, "output"), false);
assert.match(noCaption.record.reason, /recorded but not valid/u); assert.doesNotMatch(noCaption.record.reason, /does not say when/u);
console.log("macOS dates passed: blank/zero absence, impossible dates, first-valid fallback, distinct human notes and exact stamp pixels");
