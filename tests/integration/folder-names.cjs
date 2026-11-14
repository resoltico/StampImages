"use strict";
const { parseReceipt } = require("./lib/receipt.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Buffer } = require("node:buffer");
const { execFileSync } = require("node:child_process");
const [artifact, work, config, original] = process.argv.slice(2);
for (const directory of [work, path.join(work, "A"), path.join(work, "B")]) {
    fs.mkdirSync(directory, { recursive: true }); fs.copyFileSync(original, path.join(directory, "same.PNG"));
}
const occupied = path.join(work, "A", "same_stamped.PNG"); fs.writeFileSync(occupied, "Existing unrelated output.");
function stamp() {
    return parseReceipt(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", artifact, "--", "--headless", config, work], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}
function verify(receipt, suffix) {
    assert.equal(receipt.state, "complete"); assert.equal(receipt.images.length, 3);
    const outputs = [];
    for (const image of receipt.images) {
        assert.equal(image.state, "saved"); assert.equal(path.dirname(image.output), path.dirname(image.source));
        const expected = path.dirname(image.source) === path.join(work, "A") ? suffix + 1 : suffix;
        assert.equal(path.basename(image.output), `same_stamped${expected === 1 ? "" : ` ${expected}`}.PNG`);
        assert.ok(fs.readdirSync(path.dirname(image.output), { encoding: "buffer" }).some((name) => name.equals(Buffer.from(path.basename(image.output)))));
        assert.deepEqual(fs.readFileSync(image.source), fs.readFileSync(original));
        outputs.push(image.output);
    }
    return outputs;
}
verify(stamp(), 1);
const repeated = stamp(); verify(repeated, 2);
assert.equal(repeated.excluded.length, 4, "previous copies and the occupied stamped name are excluded without changing originals");
assert.equal(fs.readFileSync(occupied, "utf8"), "Existing unrelated output.");
console.log("macOS folder names passed: copies beside originals, per-folder collision groups, repeat exclusions and exact extension bytes");
