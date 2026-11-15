"use strict";
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const { createHash } = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const { iptcPacket, writeNikonFixtures, writeMalformedIccFixture } = require("./lib/capture-fixtures.cjs");
const { parseReceipt } = require("./lib/receipt.cjs");
const { buildMetadataCopyArgv, metadataCopyResult } = require("../../src/backend/metadata-copy.js");
const [script, work] = process.argv.slice(2);
fs.mkdirSync(work, { recursive: true });
const at = (name) => path.join(work, name);
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function native(tool, args, options = {}) { return execFileSync(tool, args, { encoding: "utf8", ...options }); }
function block(file, tag) { return native("exiftool", ["-b", `-${tag}`, file], { encoding: null }); }
function fields(file) {
    return JSON.parse(native("exiftool", ["-j", "-n", "-G1", "-DateTimeOriginal", "-GPSLatitude", "-GPSLongitude", "-ISO", "-BitDepth", file]))[0];
}
function derive(source, name) {
    const oriented = at(`${name}.v`), target = at(name);
    native("vips", ["autorot", source, oriented]); native("vips", ["copy", oriented, target]); return target;
}
function checkedCopy(source, target, tz = "UTC", transform = (program) => program) {
    const argv = buildMetadataCopyArgv("exiftool", source, target, { width: 900, height: 600 }).slice(1);
    const filter = argv.findIndex((value) => value.startsWith("Filter=")); argv[filter] = transform(argv[filter]);
    const output = native("exiftool", argv, { env: { ...process.env, TZ: tz } });
    return { packet: JSON.parse(output)[0].FileName, read: () => metadataCopyResult(output, source, target) };
}
function verifyUnchangedPixels(seed, target, label) {
    const difference = at(`${label}-difference.v`); native("vips", ["subtract", seed, target, difference]);
    assert.equal(Number(native("vips", ["max", difference])), 0); assert.equal(Number(native("vips", ["min", difference])), 0);
}
function product(source, status = 0, environment = {}) {
    const before = hash(source);
    const result = spawnSync("osascript", ["-l", "JavaScript", script, "--", "--headless", at("settings.json"), source], { encoding: "utf8", timeout: 120000, env: { ...process.env, ...environment } });
    assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
    const receipt = parseReceipt(result.stdout); assert.equal(receipt.images[0].state, status === 0 ? "saved" : "failed"); assert.equal(hash(source), before);
    return receipt.images[0];
}
fs.writeFileSync(at("settings.json"), JSON.stringify({ font: "Helvetica Neue Bold", size: 28, textColor: "#FFFFFF", outlineColor: "#000000", outlineWidth: 2, position: "bottom-right", margin: 24, dateFormat: "none", coordinateFormat: "none", customText: "Capture" }));
native("vips", ["black", at("canvas.v"), "900", "600", "--bands", "3"]);
native("vips", ["linear", at("canvas.v"), at("color.v"), "1 1 1", "31 79 151", "--uchar"]);
native("vips", ["copy", at("color.v"), at("clean.jpg"), "--interpretation", "srgb"]);
const noOpTarget = derive(at("clean.jpg"), "no-op-target.jpg");
const noOpBefore = hash(noOpTarget);
const noOpResult = checkedCopy(at("clean.jpg"), noOpTarget, "UTC", (program) => program.replace("my $targetIPTC=$iptcState->($dst);", "my $targetIPTC=$iptcState->($dst); $targetIPTC->{messages}=[{kind=>'Warning',text=>'Unexpected target metadata warning'}];"));
assert.throws(noOpResult.read, /Unexpected target metadata warning/u); assert.equal(hash(noOpTarget), noOpBefore);
const packet = iptcPacket(); fs.writeFileSync(at("packet.iim"), packet); fs.writeFileSync(at("prefix.iim"), packet.subarray(0, 8));
const digest = createHash("md5").update(packet).digest("hex");
for (const format of ["jpg", "tif", "png"]) {
    const source = at(`iptc.${format}`); native("vips", ["copy", at("clean.jpg"), source]);
    native("exiftool", ["-overwrite_original", `-IPTC<=${at("packet.iim")}`, `-Photoshop:IPTCDigest=${digest}`, "-DateTimeOriginal=2024:07:15 18:42:10", "-GPSLatitude=10", "-GPSLatitudeRef=N", "-GPSLongitude=20", "-GPSLongitudeRef=E", "-ICC_Profile<=/System/Library/ColorSync/Profiles/sRGB Profile.icc", source]);
    const expected = fields(source), original = hash(source), seed = derive(source, `iptc-seed.${format}`);
    assert.deepEqual(block(source, "IPTC"), packet);
    for (const tz of ["UTC", "Pacific/Auckland"]) {
        const target = at(`iptc-${format}-${tz.replace("/", "-")}.${format}`); fs.copyFileSync(seed, target);
        const copy = checkedCopy(source, target, tz); copy.read();
        assert.deepEqual(block(target, "IPTC"), packet, "original IIM bytes/timezone absence survive");
        assert.deepEqual(block(target, "ICC_Profile"), block(seed, "ICC_Profile"));
        const actual = fields(target); delete actual.SourceFile; const wanted = { ...expected }; delete wanted.SourceFile; assert.deepEqual(actual, wanted);
        verifyUnchangedPixels(seed, target, `iptc-${format}-${tz.replace("/", "-")}`); assert.equal(hash(source), original);
    }
    if (format === "jpg" || format === "tif") {
        const conflict = at(`iptc-conflict.${format}`); fs.copyFileSync(seed, conflict);
        const bytes = fs.readFileSync(conflict), stored = Buffer.from(digest, "hex");
        const offset = bytes.indexOf(stored); assert.ok(offset >= 0); assert.equal(bytes.indexOf(stored, offset + 1), -1);
        Buffer.alloc(16).copy(bytes, offset); fs.writeFileSync(conflict, bytes);
        const before = hash(conflict); const refused = checkedCopy(source, conflict);
        assert.throws(refused.read, /digest conflicts|IPTCDigest/u); assert.equal(hash(conflict), before, "equal/prefix packet with foreign digest is untouched");
    }
    const foreign = at(`iptc-foreign.${format}`); fs.copyFileSync(seed, foreign);
    native("exiftool", ["-overwrite_original", "-IPTC:ObjectName=Different target", foreign]);
    const foreignBefore = hash(foreign); assert.throws(checkedCopy(source, foreign).read); assert.equal(hash(foreign), foreignBefore);
    const unavailable = at(`iptc-unavailable.${format}`); fs.copyFileSync(seed, unavailable);
    const unavailableBefore = hash(unavailable);
    const unavailableResult = checkedCopy(source, unavailable, "UTC", (program) => program.replace("my $sourceIPTC=$iptcState->($src);", "my $sourceIPTC=$iptcState->($src); $sourceIPTC->{packet}=undef;"));
    assert.throws(unavailableResult.read, /IPTC tags have no readable binary packet/u); assert.equal(hash(unavailable), unavailableBefore);
    assert.deepEqual(block(product(source).output, "IPTC"), packet);
}
const nikon = writeNikonFixtures(work, at("clean.jpg"));
for (const source of Object.values(nikon)) {
    native("exiftool", ["-overwrite_original", `-IPTC<=${at("packet.iim")}`, `-Photoshop:IPTCDigest=${digest}`, "-ICC_Profile<=/System/Library/ColorSync/Profiles/sRGB Profile.icc", source]);
}
const seed = at("nikon-seed.jpg"), target = derive(nikon.source, "nikon-target.jpg"); fs.copyFileSync(target, seed);
assert.match(native("exiftool", ["-s", "-Warning", target]), /Bad NikonScanIFD/u, "the generated candidate detects the producer defect");
const unavailableMaker = at("nikon-unavailable.jpg"); fs.copyFileSync(seed, unavailableMaker);
const unavailableMakerBefore = hash(unavailableMaker);
const unavailableMakerResult = checkedCopy(nikon.source, unavailableMaker, "UTC", (program) => program.replace("raw=>scalar($reader->GetValue($tag,'Raw'))", "raw=>undef"));
assert.throws(unavailableMakerResult.read, /Nikon metadata does not match/u); assert.equal(hash(unavailableMaker), unavailableMakerBefore);
const sourceHash = hash(nikon.source); checkedCopy(nikon.source, target).read();
assert.equal(native("exiftool", ["-s", "-Warning", target]).trim(), "");
assert.equal(fields(target)["NikonScan:BitDepth"], 16); assert.equal(fields(target)["Nikon:ISO"], "0 400");
verifyUnchangedPixels(seed, target, "nikon"); assert.equal(hash(nikon.source), sourceHash);
assert.equal(fields(product(nikon.source).output)["NikonScan:BitDepth"], 16);
for (const [label, source, candidate] of [["foreign-target", nikon.source, derive(nikon.asymmetric, "nikon-foreign.jpg")], ["invalid-source", nikon.bad, derive(nikon.bad, "nikon-bad.jpg")]]) {
    if (label === "foreign-target") { native("exiftool", ["-overwrite_original", `-IPTC<=${at("prefix.iim")}`, candidate]); }
    const before = hash(candidate); const result = checkedCopy(source, candidate); assert.throws(result.read); assert.equal(hash(candidate), before, label);
}
for (const format of ["tif", "png"]) {
    const source = at(`nikon-combined.${format}`); native("vips", ["copy", at("clean.jpg"), source]);
    native("exiftool", ["-overwrite_original", "-TagsFromFile", nikon.source, "-all:all", `-IPTC<=${at("packet.iim")}`, `-Photoshop:IPTCDigest=${digest}`, source]);
    assert.equal(native("exiftool", ["-s", "-Warning", source]).trim(), ""); assert.deepEqual(block(source, "IPTC"), packet);
    const combined = derive(source, `nikon-combined-target.${format}`), combinedSeed = at(`nikon-combined-seed.${format}`); fs.copyFileSync(combined, combinedSeed);
    const expectedDepth = format === "png" ? 16 : undefined;
    if (format === "png") { assert.match(native("exiftool", ["-s", "-Warning", combinedSeed]), /Bad NikonScanIFD/u); }
    else { assert.equal(fields(combinedSeed)["Nikon:ISO"], undefined, "TIFF encoder omits the vendor block"); }
    checkedCopy(source, combined).read(); assert.deepEqual(block(combined, "IPTC"), packet); assert.equal(fields(combined)["NikonScan:BitDepth"], expectedDepth);
    assert.deepEqual(block(combined, "ICC_Profile"), block(combinedSeed, "ICC_Profile")); verifyUnchangedPixels(combinedSeed, combined, `nikon-combined-${format}`);
    const published = product(source).output; assert.deepEqual(block(published, "IPTC"), packet); assert.equal(fields(published)["NikonScan:BitDepth"], expectedDepth);
}
const compound = at("nikon-and-iptc.jpg"); fs.copyFileSync(seed, compound);
fs.writeFileSync(at("prefix.iim"), packet.subarray(0, 8));
native("exiftool", ["-overwrite_original", `-IPTC<=${at("prefix.iim")}`, compound]);
assert.deepEqual(block(compound, "IPTC"), packet.subarray(0, 8));
const compoundWarnings = native("exiftool", ["-a", "-s", "-Warning", "-CurrentIPTCDigest", compound]);
assert.match(compoundWarnings, /Bad NikonScanIFD/u); assert.match(compoundWarnings, /IPTCDigest is not current/u);
checkedCopy(nikon.source, compound).read(); assert.deepEqual(block(compound, "IPTC"), packet); assert.equal(fields(compound)["NikonScan:BitDepth"], 16);
const malformed = at("nikon-malformed-xmp.jpg"); fs.copyFileSync(nikon.source, malformed);
fs.writeFileSync(at("malformed.xmp"), '<x:xmpmeta xmlns:x="adobe:ns:meta/"><broken');
native("exiftool", ["-overwrite_original", `-XMP<=${at("malformed.xmp")}`, malformed]);
const malformedTarget = derive(malformed, "nikon-malformed-target.jpg");
const malformedBefore = hash(malformedTarget); assert.throws(checkedCopy(malformed, malformedTarget).read); assert.equal(hash(malformedTarget), malformedBefore);
const healthy = at("nikon-healthy-foreign.jpg"); fs.copyFileSync(nikon.asymmetric, healthy);
checkedCopy(nikon.source, healthy).read(); assert.equal(fields(healthy)["Nikon:ISO"], "0 800"); assert.equal(fields(healthy)["NikonScan:BitDepth"], 8);
const wrapper = at("metadata-control"); fs.writeFileSync(wrapper, `#!/usr/bin/env node\nrequire(${JSON.stringify(require.resolve("./lib/metadata-failure.cjs"))}).runMetadataFailure(process.argv.slice(2));\n`); fs.chmodSync(wrapper, 0o755);
const webp = at("wrapper-source.webp"); native("vips", ["copy", at("clean.jpg"), webp]);
native("exiftool", ["-overwrite_original", "-DateTimeOriginal=2024:07:15 12:34:56", webp]);
const malformedIcc = writeMalformedIccFixture(at("clean.jpg"), at("malformed-icc.jpg"));
assert.match(native("exiftool", ["-s", "-Warning", malformedIcc]), /ICC_Profile/u);
assert.equal(product(malformedIcc).unconverted, true, "malformed source ICC remains accepted by the existing pixel fallback");
const cases = ["producer-write", "producer-readback", "final-reader-warning", "fresh-target-wrapper", "fresh-view-same-warning", "cached-target-wrapper"];
for (const mode of cases) {
    const before = fs.readdirSync(work).filter((name) => name.includes("_stamped"));
    const marker = at(`${mode}.marker`), record = at(`${mode}.json`);
    let { source } = nikon;
    if (mode === "fresh-view-same-warning") { source = malformedIcc; }
    else if (mode.includes("target-wrapper")) { source = webp; }
    const status = mode === "cached-target-wrapper" ? 0 : 1;
    product(source, status, { STAMP_IMAGES_EXIFTOOL: wrapper, STAMP_IMAGES_REAL_EXIFTOOL: native("/usr/bin/which", ["exiftool"]).trim(), STAMP_IMAGES_METADATA_CONTROL: mode, STAMP_IMAGES_METADATA_MARKER: marker, STAMP_IMAGES_METADATA_CONTROL_RECORD: record });
    assert.equal(fs.readFileSync(marker, "utf8"), "called");
    const evidence = JSON.parse(fs.readFileSync(record, "utf8")); assert.equal(evidence.nativeStatus, 0);
    if (mode.includes("target-wrapper")) { assert.equal(evidence.packet[0].FileName.RebuiltTargetWebPExif, "1", "the old cached wrapper is actually repaired"); }
    if (status === 1) { assert.deepEqual(fs.readdirSync(work).filter((name) => name.includes("_stamped")), before, "write/readback/fresh-reader failures publish nothing"); }
    else { assert.equal(evidence.packet[0].FileName.TargetReadWarning, "[minor] Improper EXIF header", "the cached old warning is independently present"); }
}
process.stdout.write("Exact IPTC packets and bounded Nikon producer repair passed, including two timezones and foreign/source-negative controls.\n");
