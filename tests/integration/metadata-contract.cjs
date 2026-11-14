"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const { createHash } = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const [script, work] = process.argv.slice(2);
const at = (name) => path.join(work, name);
const digest = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const notices = [];
function native(tool, args) {
    const result = spawnSync(tool, args, { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${tool}: ${result.stdout}\n${result.stderr}`);
    if (result.stderr.trim()) { notices.push({ tool, message: result.stderr.trim() }); }
    return result.stdout.trim();
}
function stamp(file, status = 0, environment = {}) {
    const result = spawnSync("osascript", ["-l", "JavaScript", script, "--", "--headless", at("metadata-settings.json"), file], { encoding: "utf8", env: { ...process.env, ...environment }, timeout: 120000 });
    assert.ifError(result.error);
    assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
    return JSON.parse(result.stdout);
}
function metadata(file) {
    return JSON.parse(native("exiftool", ["-j", "-n", "-a", "-G1", "-DateTimeOriginal", "-GPSLatitude", "-GPSLongitude", "-Make", "-Model", "-ExposureTime", "-FNumber", "-Orientation", "-ExifImageWidth", "-ExifImageHeight", "-XMP-tiff:ImageWidth", "-XMP-tiff:ImageHeight", "-XMP-dc:Title", "-XMP-hdrgm:Version", file]))[0];
}
function point(file, left, top) { return native("vips", ["getpoint", file, String(left), String(top)]).split(/\s+/u).map(Number); }
function captionPeak(file, width, height, label) {
    const region = at(`metadata-${label}-caption-region.v`);
    const rgb = at(`metadata-${label}-caption-rgb.v`);
    native("vips", ["crop", file, region, String(width - 200), String(height - 120), "200", "120"]);
    native("vips", ["extract_band", region, rgb, "0", "--n", "3"]);
    return Number(native("vips", ["max", rgb]));
}
function verifyPixels(file, orientation, width, height) {
    const positions = { 1: [90, 110], 6: [489, 90], 8: [110, 809] };
    const [left, top] = positions[orientation];
    const marker = point(file, left, top);
    assert.ok(marker[0] > marker[1] + 80 && marker[0] > marker[2] + 80, `upright red marker: ${marker}`);
    const background = point(file, 300, 300);
    assert.ok(background.length === 3 || background.length === 4, `expected RGB or RGBA fixture: ${background}`);
    assert.ok(background.slice(0, 3).every((value) => Math.abs(value - 80) < 12), `metadata copy background ${file}: ${background}`);
    if (background.length === 4) { assert.equal(background[3], 255, "opaque source alpha is preserved"); }
    assert.ok(captionPeak(file, width, height, "output") > 200, "the white caption is visible in RGB, independently of opaque alpha");
}
function verifyCopy(source, output, orientation) {
    const [width, height] = orientation === 1 ? [900, 600] : [600, 900];
    assert.equal(Number(native("vipsheader", ["-f", "width", output])), width);
    assert.equal(Number(native("vipsheader", ["-f", "height", output])), height);
    const fields = metadata(output);
    assert.equal(fields["ExifIFD:DateTimeOriginal"], "2026:11:14 12:34:56");
    assert.equal(fields["GPS:GPSLatitude"], 10);
    assert.equal(fields["GPS:GPSLongitude"], 20);
    assert.equal(fields["IFD0:Make"], "Synthetic");
    assert.equal(fields["IFD0:Model"], "Generated Camera");
    assert.equal(fields["ExifIFD:ExposureTime"], 1 / 125);
    assert.equal(fields["ExifIFD:FNumber"], 5.6);
    assert.equal(fields["IFD0:Orientation"], 1);
    for (const field of ["ExifIFD:ExifImageWidth", "XMP-exif:ExifImageWidth", "XMP-tiff:ImageWidth"]) { assert.equal(fields[field], width); }
    for (const field of ["ExifIFD:ExifImageHeight", "XMP-exif:ExifImageHeight", "XMP-tiff:ImageHeight"]) { assert.equal(fields[field], height); }
    assert.equal(fields["XMP-dc:Title"], "Generated capture metadata");
    assert.equal(fields["XMP-hdrgm:Version"], undefined);
    assert.deepEqual(execFileSync("exiftool", ["-icc_profile", "-b", output]), execFileSync("exiftool", ["-icc_profile", "-b", source]), "ICC profile retained");
    assert.ok(captionPeak(source, 900, 600, "source") < 150, "unmarked source cannot satisfy the bright-caption check");
    verifyPixels(output, orientation, width, height);
}
function sourceFor(extension, orientation) {
    const source = at(`metadata-${extension}-${orientation}.${extension}`);
    native("vips", ["copy", at("metadata-pattern.png"), source]);
    native("exiftool", ["-overwrite_original", "-DateTimeOriginal=2026:11:14 12:34:56", "-CreateDate=2026:11:14 12:34:56", "-GPSLatitude=10", "-GPSLatitudeRef=N", "-GPSLongitude=20", "-GPSLongitudeRef=E", "-Make=Synthetic", "-Model=Generated Camera", "-ExposureTime=1/125", "-FNumber=5.6", `-Orientation#=${orientation}`, "-ICC_Profile<=/System/Library/ColorSync/Profiles/sRGB Profile.icc", "-XMP-dc:Title=Generated capture metadata", "-XMP-hdrgm:Version=1.0", "-XMP-tiff:ImageWidth=900", "-XMP-tiff:ImageHeight=600", "-XMP-exif:ExifImageWidth=900", "-XMP-exif:ExifImageHeight=600", source]);
    return source;
}
function failedRetentionPublishesNothing(source) {
    const wrapper = at("metadata-write-failure");
    const marker = at("metadata-write-attempted");
    const outputs = fs.readdirSync(work).filter((name) => name.includes("_stamped"));
    fs.writeFileSync(wrapper, '#!/bin/bash\nfor argument in "$@"; do\n  if [ "$argument" = "-TagsFromFile" ]; then\n    printf called >> "$STAMP_IMAGES_METADATA_MARKER"\n    echo "synthetic metadata write failure" >&2\n    exit 1\n  fi\ndone\nexec "$STAMP_IMAGES_REAL_EXIFTOOL" "$@"\n');
    fs.chmodSync(wrapper, 0o755);
    const before = digest(source);
    const result = stamp(source, 1, { STAMP_IMAGES_EXIFTOOL: wrapper, STAMP_IMAGES_REAL_EXIFTOOL: native("/usr/bin/which", ["exiftool"]), STAMP_IMAGES_METADATA_MARKER: marker });
    assert.equal(fs.readFileSync(marker, "utf8"), "called");
    assert.equal(result.images[0].state, "failed");
    assert.match(JSON.stringify(result.images[0].issues), /synthetic metadata write failure/u);
    assert.deepEqual(fs.readdirSync(work).filter((name) => name.includes("_stamped")), outputs, "failed metadata retention publishes no additional file");
    assert.equal(digest(source), before);
}
fs.writeFileSync(at("metadata-pattern.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#505050"/><rect x="50" y="70" width="80" height="80" fill="#e65050"/></svg>');
native("vips", ["copy", at("metadata-pattern.svg"), at("metadata-pattern.png")]);
fs.writeFileSync(at("metadata-settings.json"), JSON.stringify({ font: "Helvetica Neue Bold", size: 28, textColor: "#FFFFFF", outlineColor: "#000000", outlineWidth: 2, position: "bottom-right", margin: 24, dateFormat: "none", coordinateFormat: "none", customText: "Metadata" }));
let failureSource = "";
for (const extension of ["jpg", "png", "tif", "webp", "heic", "avif"]) {
    for (const orientation of ["jpg", "tif"].includes(extension) ? [1, 6, 8] : [1]) {
        const source = sourceFor(extension, orientation);
        const before = digest(source);
        const result = stamp(source);
        assert.equal(result.images[0].state, "saved");
        verifyCopy(source, result.images[0].output, orientation);
        assert.equal(digest(source), before, "source bytes unchanged");
        if (!failureSource) { failureSource = source; }
    }
}
failedRetentionPublishesNothing(failureSource);
fs.writeFileSync(at("metadata-tool-notices.json"), JSON.stringify(notices, null, 2));
process.stdout.write("Capture metadata, ICC, upright pixels and failure publication checks passed for six output formats.\n");
