"use strict";
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const [script, config, source, root] = process.argv.slice(2);
const digest = (filename) => crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");

function actualEntry(filename) {
    assert.equal(fs.lstatSync(filename).isFile(), true);
    const basename = Buffer.from(path.basename(filename));
    const entries = fs.readdirSync(path.dirname(filename), { encoding: "buffer" });
    assert.ok(entries.some((entry) => entry.equals(basename)), "receipt basename bytes differ from the raw directory entry");
    assert.ok(basename.length <= 255);
    return path.basename(filename);
}

for (const [index, spec] of [
    { name: "café.png", expected: "café_stamped.png" },
    { name: "cafe\u0301.png", expected: "cafe\u0301_stamped.png" },
    { name: "photo.png", occupied: "PHOTO_stamped.png", expected: "photo_stamped 2.png" },
    { name: "rīga.png", occupied: "ri\u0304ga_stamped.png", expected: "rīga_stamped 2.png" },
    { name: `${"é".repeat(120)}.png` }
].entries()) {
    const directory = path.join(root, String(index)); fs.mkdirSync(directory, { recursive: true });
    const input = path.join(directory, spec.name); fs.copyFileSync(source, input);
    const before = digest(input);
    if (spec.occupied) { fs.writeFileSync(path.join(directory, spec.occupied), "Occupied by somebody else."); }
    const output = execFileSync("/usr/bin/osascript", ["-l", "JavaScript", script, "--", "--headless", config, input], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const receipt = JSON.parse(output);
    assert.equal(receipt.state, "complete"); assert.equal(receipt.images.length, 1);
    const actual = actualEntry(receipt.images[0].output);
    if (spec.expected) { assert.equal(actual, spec.expected); }
    else { assert.equal(actual.normalize("NFC"), actual); }
    assert.equal(digest(input), before);
    if (spec.occupied) { assert.equal(fs.readFileSync(path.join(directory, spec.occupied), "utf8"), "Occupied by somebody else."); }
    console.log(JSON.stringify({ rawNameChecked: actual, sourceUnchanged: true }));
}
