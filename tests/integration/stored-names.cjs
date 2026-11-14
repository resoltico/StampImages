"use strict";
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const [probe, folder, volume] = process.argv.slice(2);
fs.mkdirSync(folder);
// A filename-port fixture, not an image-validity claim. C-created FAT32 names
// can be normalized by Foundation even when Node-created names are not.
for (const [index, name] of ["café_stamped 2.png", "café_stamped.png"].entries()) {
    const destination = path.join(folder, name), source = path.join(folder, `ascii-source-${index}`);
    const bytes = Buffer.from(`owned filename readback ${index}`);fs.writeFileSync(source, bytes, { flag: "wx" });
    const original = fs.statSync(source, { bigint: true });
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", probe, source, destination], { encoding: "utf8", timeout: 10000 });
    assert.ifError(result.error);assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout), raw = fs.readdirSync(folder, { encoding: "buffer" });
    assert.ok(raw.some((entry) => entry.equals(Buffer.from(path.basename(observed.actual)))), JSON.stringify({ requirement: "POSIX-created stored name equals a raw entry", volume, ...observed, entries: raw.map((entry) => entry.toString("hex")) }));
    assert.deepEqual(observed.observed, observed.expected);assert.deepEqual(observed.expected, { identity: `${original.dev}:${original.ino}`, size: bytes.length });
    const actual = fs.statSync(observed.actual, { bigint: true });assert.equal(actual.dev, original.dev);assert.equal(actual.ino, original.ino);
    assert.equal(fs.existsSync(source), false);assert.deepEqual(fs.readFileSync(observed.actual), bytes);
}
console.log(JSON.stringify({ volume, rawStoredNamesChecked: 2 }));
