"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { generateGpsFixtures } = require("../../integration/lib/gps-fixtures.cjs");

test("refuses a nonempty destination before invoking tools or changing its contents", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gps-fixture-guard-"));
    const marker = path.join(directory, "keep.txt");
    try {
        fs.writeFileSync(marker, "unrelated contents");
        assert.throws(() => generateGpsFixtures(directory, { vips: "must-not-run", exiftool: "must-not-run" }), /must be new or empty/u);
        assert.deepEqual(fs.readdirSync(directory), ["keep.txt"]);
        assert.equal(fs.readFileSync(marker, "utf8"), "unrelated contents");
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("refuses an unsupported container before creating output or invoking tools", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "gps-fixture-format-"));
    const directory = path.join(parent, "not-created");
    try {
        assert.throws(() => generateGpsFixtures(directory, { formats: ["gif"], vips: "must-not-run", exiftool: "must-not-run" }), /Unsupported fixture format/u);
        assert.equal(fs.existsSync(directory), false);
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
