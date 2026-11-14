"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const { generateGpsFixtures } = require("./lib/gps-fixtures.cjs");
const { verifyGpsFixtures, readGpsRecord, decodedHash } = require("./lib/gps-fixture-verification.cjs");
const { buildMetadataCopyArgv, metadataCopyResult } = require("../../src/backend/metadata-copy.js");
const [artifact, work] = process.argv.slice(2);
const at = name => path.join(work, name);
fs.mkdirSync(work, { recursive: true });
const vips = execFileSync("/usr/bin/which", ["vips"], { encoding: "utf8" }).trim();
const exiftool = execFileSync("/usr/bin/which", ["exiftool"], { encoding: "utf8" }).trim();
const commands = [];
function run(argv, binary = false) {
    const result = spawnSync(argv[0], argv.slice(1), { encoding: binary ? undefined : "utf8", timeout: 30000, env: { ...process.env, LC_ALL: "C", VIPS_CONCURRENCY: "2" } });
    assert.ifError(result.error); assert.equal(result.status, 0, `${argv[0]}: ${result.stderr}`);
    commands.push({ argv, status: result.status, stderr: String(result.stderr) }); return result.stdout;
}
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = generateGpsFixtures(at("fixtures"), { vips, exiftool });
assert.equal(manifest.files.length, 78); assert.equal(manifest.bases.length, 6);
const verified = verifyGpsFixtures(manifest, { vips, exiftool });
assert.equal(verified.rows.length, 78);
fs.writeFileSync(at("fixture-verification.json"), JSON.stringify(verified));
// Reject a malformed manifest before any native command, and detect an actual
// copied-wire mutation against independent literal fixture expectations.
assert.throws(() => verifyGpsFixtures({ ...manifest, files: manifest.files.slice(1) }, { vips: "must-not-run", exiftool: "must-not-run" }), /Fixture manifest must include every expected case/u);
const originalFixture = manifest.files.find(row => row.name === "valid-sw" && row.format === "jpg");
const originalHash = digest(originalFixture.path);
const wrongFixture = at("wrong-fixture.jpg"); fs.copyFileSync(originalFixture.path, wrongFixture);
run([exiftool, "-overwrite_original", "-GPSLatitude=23.9519", wrongFixture]);
const changedManifest = { ...manifest, files: manifest.files.map(row => row === originalFixture ? { ...row, path: wrongFixture } : row) };
assert.throws(() => verifyGpsFixtures(changedManifest, { vips, exiftool }), /valid-sw\.jpg latitude/u);
assert.equal(digest(originalFixture.path), originalHash);
const unsupported = new Set(["signed-negative", "wrong-count", "wrong-type"]);
function comparable(record) {
    // Container byte order may legitimately differ while fractions/refs remain exact.
    const { binaryHex, ...claims } = record;
    assert.equal(typeof binaryHex === "string" || binaryHex === undefined, true);
    return claims;
}
const copied = [];
fs.mkdirSync(at("api"));
for (const file of manifest.files) {
    const target = path.join(at("api"), `${file.name}.${file.format}`); fs.copyFileSync(file.base, target);
    const before = digest(file.path);
    const output = run(buildMetadataCopyArgv(exiftool, file.path, target, { width: 900, height: 600 }));
    const packet = JSON.parse(output)[0].FileName;
    if (unsupported.has(file.name)) {
        assert.throws(() => metadataCopyResult(output, file.path, target));
        assert.equal(packet.WriteStatus, "0"); assert.ok(Number(packet.FailureCount) > 0);
    } else {
        assert.deepEqual(metadataCopyResult(output, file.path, target), { locationRetained: true });
        assert.deepEqual(comparable(readGpsRecord({ path: target }, run, exiftool)), comparable(verified.rows.find(row => row.path === file.path).readback));
        assert.equal(decodedHash(target, run, work, vips), verified.rows.find(row => row.path === file.path).pixels);
    }
    assert.equal(digest(file.path), before);
    copied.push({ name: file.name, format: file.format, packet });
}
fs.writeFileSync(at("api-results.json"), JSON.stringify(copied));
function noPrivateFields(value) {
    if (!value || typeof value !== "object") { return; }
    const forbidden = new Set(["FileName", "TargetFile", "ExifToolVersion", "WriteStatus", "RawWriteStatus", "VerifiedGPS", "SourceReadNotice", "SourceReaderViewNotice", "ExcludedSourceReaderGroups", "PreservedEmptyTargetMakerNotes", "stack"]);
    for (const [key, field] of Object.entries(value)) { assert.equal(forbidden.has(key), false, `private metadata field leaked: ${key}`); noPrivateFields(field); }
}
const settings = { font: "Menlo", size: 24, textColor: "#FFFFFF", outlineColor: "#000000", outlineWidth: 0, position: "bottom-right", margin: 24, dateFormat: "none", coordinateFormat: "decimal", customText: "GPS" };
let sequence = 0;
function stamp(file, config = {}, env = {}) {
    const configPath = at(`settings-${sequence}.json`); sequence += 1;
    fs.writeFileSync(configPath, JSON.stringify({ ...settings, ...config }));
    const before = digest(file);
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", artifact, "--", "--headless", configPath, file], { encoding: "utf8", timeout: 60000, killSignal: "SIGKILL", env: { ...process.env, ...env } });
    assert.ifError(result.error); assert.equal(result.signal, null, result.stderr); assert.equal(digest(file), before);
    const receipt = JSON.parse(result.stdout); assert.equal(receipt.images.length, 1);
    noPrivateFields(receipt);
    fs.writeFileSync(at(`receipt-${sequence}.json`), result.stdout); fs.writeFileSync(at(`report-${sequence}.txt`), result.stderr);
    return { result, receipt, image: receipt.images[0] };
}
function samePixels(first, second) {
    assert.equal(decodedHash(first, run, work, vips), decodedHash(second, run, work, vips), "visible inscriptions must be exactly equal");
}
const positive = new Set(["valid-sw", "xmp-only-sw", "mixed"]);
const rendered = new Map();
for (const file of manifest.files.filter(row => row.format === "jpg")) {
    const made = stamp(file.path);
    if (unsupported.has(file.name)) {
        assert.equal(made.result.status, 1, made.result.stderr); assert.equal(made.image.state, "failed");
        assert.deepEqual(made.image.invalidMetadata, ["GPS coordinates"]);
        assert.equal(Object.hasOwn(made.image, "output"), false); assert.equal(Object.hasOwn(made.image, "crowded"), false);
    } else {
        assert.equal(made.result.status, positive.has(file.name) ? 0 : 1, made.result.stderr);
        assert.equal(made.image.state, "saved"); assert.ok(fs.existsSync(made.image.output));
        assert.deepEqual(comparable(readGpsRecord({ path: made.image.output }, run, exiftool)), comparable(verified.rows.find(row => row.path === file.path).readback));
        if (positive.has(file.name)) { assert.equal(made.image.invalidMetadata, undefined); rendered.set(file.name, made.image.output); }
        else {
            assert.deepEqual(made.image.invalidMetadata, ["GPS coordinates"]); assert.deepEqual(made.image.missingMetadata, ["GPS coordinates"]);
            const caption = stamp(file.path, { coordinateFormat: "none" });
            assert.equal(caption.result.status, 0, caption.result.stderr); samePixels(made.image.output, caption.image.output);
        }
    }
}
samePixels(rendered.get("valid-sw"), rendered.get("xmp-only-sw"));
samePixels(rendered.get("valid-sw"), rendered.get("mixed"));
for (const file of manifest.files.filter(row => row.format !== "jpg" && ["valid-sw", "bad-refs"].includes(row.name))) {
    const made = stamp(file.path); assert.equal(made.result.status, file.name === "valid-sw" ? 0 : 1, made.result.stderr);
    assert.equal(made.image.state, "saved");
    assert.deepEqual(comparable(readGpsRecord({ path: made.image.output }, run, exiftool)), comparable(verified.rows.find(row => row.path === file.path).readback));
    if (file.name === "bad-refs") { assert.deepEqual(made.image.invalidMetadata, ["GPS coordinates"]); }
}
const clean = stamp(manifest.bases.find(row => row.format === "png").path, { coordinateFormat: "none" });
assert.equal(clean.result.status, 0, clean.result.stderr); assert.equal(clean.image.state, "saved");
const wrapper = at("controlled-exiftool");
fs.writeFileSync(wrapper, `#!/usr/bin/env node\nrequire(${JSON.stringify(require.resolve("./lib/metadata-failure.cjs"))}).runMetadataFailure(process.argv.slice(2));\n`); fs.chmodSync(wrapper, 0o755);
const controlled = manifest.files.find(row => row.format === "jpg" && row.name === "valid-sw");
for (const mode of ["setter", "readback", "wrong-target", "missing-target"]) {
    const marker = at(`${mode}-attempted`); const record = at(`${mode}-native.json`);
    const outputs = fs.readdirSync(path.dirname(controlled.path)).filter(name => name.includes("_stamped"));
    const made = stamp(controlled.path, {}, { STAMP_IMAGES_EXIFTOOL: wrapper, STAMP_IMAGES_REAL_EXIFTOOL: exiftool, STAMP_IMAGES_METADATA_CONTROL: mode, STAMP_IMAGES_METADATA_MARKER: marker, STAMP_IMAGES_METADATA_CONTROL_RECORD: record });
    assert.equal(made.result.status, 1, made.result.stderr); assert.equal(made.image.state, "failed");
    assert.equal(fs.readFileSync(marker, "utf8"), "called", "the live metadata writer must be reached exactly once");
    assert.equal(Object.hasOwn(made.image, "output"), false);
    assert.deepEqual(fs.readdirSync(path.dirname(controlled.path)).filter(name => name.includes("_stamped")), outputs, "no failed metadata operation publishes a file");
    const evidence = JSON.parse(fs.readFileSync(record, "utf8")); const packet = evidence.packet[0].FileName;
    assert.equal(evidence.nativeStatus, 0, "the protocol must detect failure even after process success");
    if (mode === "setter") { assert.equal(packet.WriteStatus, "0"); assert.equal(packet.RawWriteStatus, "0"); assert.match(packet.FailureText, /Required metadata could not be queued/u); }
    if (mode === "readback") { assert.equal(packet.WriteStatus, "0"); assert.equal(packet.RawWriteStatus, "1"); assert.equal(packet.VerifiedGPS, "0"); assert.match(packet.FailureText, /Raw GPS read-back differs/u); }
    if (mode === "wrong-target") { assert.equal(packet.WriteStatus, "1"); assert.notEqual(packet.TargetFile, evidence.originalTarget); }
    if (mode === "missing-target") { assert.equal(packet.WriteStatus, "1"); assert.equal(Object.hasOwn(packet, "TargetFile"), false); }
}
for (const base of manifest.bases) { assert.equal(digest(base.path), base.before); }
fs.writeFileSync(at("command-evidence.json"), JSON.stringify(commands));
console.log("Raw GPS passed: 78 independently verified fixtures/native writes, strict invalid captions, namespace precedence, six formats and live zero-status failure guards");
