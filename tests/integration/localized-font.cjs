"use strict";
const { parseReceipt } = require("./lib/receipt.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");
const [artifact, work, original, settingsPath, catalogProbe] = process.argv.slice(2);
const settings = { ...JSON.parse(fs.readFileSync(settingsPath, "utf8")), dateFormat: "none", coordinateFormat: "none", customText: "Riga 日本語" };
const originalBytes = fs.readFileSync(original);
function rendered(name, font, accepted = true) {
    const folder = path.join(work, name); fs.mkdirSync(folder, { recursive: true });
    const source = path.join(folder, "photo.png");
    const output = path.join(folder, "photo_stamped.png");
    const config = path.join(folder, "settings.json");
    fs.copyFileSync(original, source); fs.writeFileSync(config, JSON.stringify({ ...settings, font }));
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", artifact, "--", "--headless", config, source], { encoding: "utf8", timeout: 30000, killSignal: "SIGKILL" });
    assert.ifError(result.error); assert.equal(result.signal, null, result.stderr);
    const receipt = parseReceipt(result.stdout);
    assert.deepEqual(fs.readFileSync(source), originalBytes);
    if (accepted) {
        assert.equal(result.status, 0, result.stderr); assert.equal(receipt.images[0].state, "saved");
        assert.equal(receipt.images[0].output, output);
        execFileSync("vips", ["avg", `${output}[fail_on=warning]`], { stdio: "pipe" });
    } else {
        assert.equal(result.status, 2, result.stderr); assert.equal(receipt.state, "invalid");
        assert.equal(receipt.issues[0].field, "font"); assert.equal(fs.existsSync(output), false);
    }
    return output;
}
const canonical = new Map();
for (const [index, font] of ["Hiragino Sans W3", "Hiragino Sans W6", "Hiragino Sans"].entries()) {
    canonical.set(font, rendered(`canonical-${index}`, font));
}
for (const [index, [alias, font]] of [
    ["ヒラギノ角ゴシック W3", "Hiragino Sans W3"],
    ["  ヒラギノ角ゴシック w3  ", "Hiragino Sans W3"],
    ["ヒラギノ角ゴシック W6", "Hiragino Sans W6"],
    ["ヒラギノ角ゴシック", "Hiragino Sans"]
].entries()) {
    const output = rendered(`alias-${index}`, alias);
    const difference = path.join(work, `difference-${index}.v`);
    execFileSync("vips", ["subtract", output, canonical.get(font), difference]);
    const absolute = path.join(work, `absolute-${index}.v`); execFileSync("vips", ["abs", difference, absolute]);
    assert.equal(Number(execFileSync("vips", ["max", absolute], { encoding: "utf8" }).trim()), 0, `${alias} differs from its canonical rendered face`);
}
// Pango treats the existing W3/W6 style words alike on this host. Native
// catalog identity, rather than an unsupported raster-weight assumption,
// independently establishes that alias resolution keeps these faces distinct.
const installed = JSON.parse(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", catalogProbe], { encoding: "utf8" }));
assert.deepEqual(installed.map((entry) => entry.resolved), [
    { family: "Hiragino Sans", face: "W3" }, { family: "Hiragino Sans", face: "W6" },
    { family: "Hiragino Sans", face: "W3" }, { family: "Hiragino Sans", face: "W6" },
    { family: "Hiragino Sans", face: "" }
]);
assert.deepEqual(installed.slice(0, 4).map((entry) => entry.native), ["HiraginoSans-W3", "HiraginoSans-W6", "HiraginoSans-W3", "HiraginoSans-W6"]);
for (const [index, name] of ["Georgia-Bold", ".SF NS", "ヒラギノ角ゴシック W99"].entries()) { rendered(`refused-${index}`, name, false); }
assert.deepEqual(fs.readFileSync(original), originalBytes);
console.log("macOS localized fonts passed: full/style/family aliases match canonical pixels, distinct native face identities, unsafe fallback names refuse");
