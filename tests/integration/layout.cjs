"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const [artifact, work, original, settingsPath] = process.argv.slice(2);
fs.mkdirSync(work, { recursive: true });
const originalBytes = fs.readFileSync(original);
const settings = { ...JSON.parse(fs.readFileSync(settingsPath, "utf8")), font: "Menlo", size: 36, outlineWidth: 0, textColor: "#FFFFFF", dateFormat: "none", coordinateFormat: "none", position: "top-left", margin: 24 };
let sequence = 0;
function native(...argv) { return execFileSync(argv[0], argv.slice(1), { encoding: "utf8" }).trim(); }
function stamp(customText, changes = {}) {
    const folder = path.join(work, String(sequence)); sequence += 1; fs.mkdirSync(folder);
    const source = path.join(folder, "photo.png"); const config = path.join(folder, "settings.json");
    fs.copyFileSync(original, source); fs.writeFileSync(config, JSON.stringify({ ...settings, customText, ...changes }));
    const result = spawnSync("/usr/bin/osascript", ["-l", "JavaScript", artifact, "--", "--headless", config, source], { encoding: "utf8", timeout: 30000, killSignal: "SIGKILL" });
    assert.ifError(result.error); assert.equal(result.signal, null, result.stderr);
    assert.deepEqual(fs.readFileSync(source), originalBytes);
    const receipt = JSON.parse(result.stdout); assert.equal(receipt.images.length, 1);
    return { folder, result, receipt, image: receipt.images[0] };
}
function pixels(file) {
    const width = Number(native("vipsheader", "-f", "width", file));
    const height = Number(native("vipsheader", "-f", "height", file));
    const bands = Number(native("vipsheader", "-f", "bands", file));
    assert.equal(native("vipsheader", "-f", "format", file), "((VipsBandFormat) VIPS_FORMAT_UCHAR)");
    const raw = path.join(work, `pixels-${sequence}.raw`); sequence += 1; native("vips", "rawsave", file, raw);
    return { width, height, bands, data: fs.readFileSync(raw) };
}
function changed(image, offset) {
    return image.bands === 1 ? image.data[offset] !== 0
        : image.data[offset] !== 110 || image.data[offset + 1] !== 110 || image.data[offset + 2] !== 110;
}
function bounds(image, first = 0, last = image.height - 1, fromColumn = 0) {
    let left = image.width; let right = -1; let top = image.height; let bottom = -1;
    for (let row = first; row <= last; row += 1) {
        for (let column = fromColumn; column < image.width; column += 1) {
            const offset = (row * image.width + column) * image.bands;
            if (changed(image, offset)) { left = Math.min(left, column); right = Math.max(right, column); top = Math.min(top, row); bottom = Math.max(bottom, row); }
        }
    }
    assert.ok(right >= left && bottom >= top, "a rendered stamp has visible pixels");
    return { left, right, top, bottom };
}
function rows(image) {
    const active = [];
    for (let row = 0; row < image.height; row += 1) {
        let marked = false;
        for (let column = 0; column < image.width && !marked; column += 1) {
            const offset = (row * image.width + column) * image.bands;
            marked = changed(image, offset);
        }
        if (marked) { active.push(row); }
    }
    const groups = [];
    for (const row of active) {
        const last = groups.at(-1);
        if (!last || row - last[1] > 4) { groups.push([row, row]); }
        else { last[1] = row; }
    }
    return groups.map(([first, last]) => bounds(image, first, last));
}
function linePixels(image, box) {
    const values = [];
    for (let row = box.top; row <= box.bottom; row += 1) {
        for (let column = box.left; column <= box.right; column += 1) {
            const offset = (row * image.width + column) * image.bands;
            values.push(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
        }
    }
    return Buffer.from(values);
}
// A visible LTR marker establishes the logical origin independently of the
// production LRM mechanism. Native H/HH widths measure its advance; excluding
// only that marker leaves each line's true ink bearing, before block cropping.
function maskFor(text, label) {
    const file = path.join(work, `${label}.v`);
    native("vips", "text", file, text, "--font", "Menlo, 36", "--dpi", "72");
    return pixels(file);
}
const marker = maskFor("H", "logical-marker");
const advance = maskFor("HH", "logical-advance").width - marker.width;
assert.ok(bounds(marker).right < advance, "the reference column excludes the complete marker");
const bearings = new Map();
for (const [index, text] of ["Latin words", "שלום,123!", "مرحبا12:34!"].entries()) {
    const reference = maskFor(`H\u2068${text}\u2069`, `logical-reference-${index}`);
    const box = bounds(reference, 0, reference.height - 1, advance);
    bearings.set(text, { offset: box.left - advance, width: box.right - box.left + 1, height: box.bottom - box.top + 1 });
}
const opposite = rows(maskFor("\u2068Latin words\u2069\n\u2068שלום,123!\u2069", "opposite-alignment-negative"));
assert.equal(opposite.length, 2);
assert.notEqual(opposite[1].left, bearings.get("שלום,123!").offset - Math.min(bearings.get("Latin words").offset, bearings.get("שלום,123!").offset), "the original automatic opposite alignment must fail this logical-origin check");
const controls = new Map();
for (const text of ["Latin words", "שלום,123!", "مرحبا12:34!"]) {
    const made = stamp(text); assert.equal(made.result.status, 0, made.result.stderr);
    const image = pixels(made.image.output); const box = bounds(image); const bearing = bearings.get(text);
    assert.deepEqual([box.right - box.left + 1, box.bottom - box.top + 1], [bearing.width, bearing.height], "reference excludes only the marker, not caption ink");
    controls.set(text, { image, box });
}
for (const [first, second, separator] of [
    ["Latin words", "שלום,123!", "\n"], ["שלום,123!", "Latin words", "\n"],
    ["Latin words", "שלום,123!", "\u2029"], ["שלום,123!", "Latin words", "\u2029"],
    ["Latin words", "مرحبا12:34!", "\u2029"], ["مرحبا12:34!", "Latin words", "\n"]
]) {
    const made = stamp(first + separator + second); assert.equal(made.result.status, 0, made.result.stderr);
    const image = pixels(made.image.output); const lines = rows(image);
    assert.equal(lines.length, 2, `two complete visible lines: ${JSON.stringify([first, second, separator])}`);
    for (const [index, text] of [first, second].entries()) {
        const control = controls.get(text);
        const cropOffset = Math.min(bearings.get(first).offset, bearings.get(second).offset);
        assert.equal(lines[index].left, settings.margin + bearings.get(text).offset - cropOffset, "logical left origins agree after native bearings and common block crop");
        assert.deepEqual([lines[index].right - lines[index].left, lines[index].bottom - lines[index].top], [control.box.right - control.box.left, control.box.bottom - control.box.top]);
        assert.deepEqual(linePixels(image, lines[index]), linePixels(control.image, control.box), "the whole punctuation/number raster retains its order");
    }
}
// A direct native mask supplies dimensions and ink offsets independently of
// the product's positioning function and compositor call.
const maskFile = path.join(work, "margin-mask.v");
native("vips", "text", maskFile, "\u200e\u2068HHH\u2069", "--font", "Menlo, 36", "--dpi", "72");
const mask = pixels(maskFile); const ink = bounds(mask);
for (const [position, horizontal, vertical] of [
    ["top-left", "left", "top"], ["top-right", "right", "top"],
    ["bottom-left", "left", "bottom"], ["bottom-right", "right", "bottom"],
    ["top-center", "center", "top"], ["bottom-center", "center", "bottom"]
]) {
    const made = stamp("HHH", { position, margin: 2000 }); assert.equal(made.result.status, 0, made.result.stderr);
    assert.equal(made.image.crowded, true);
    assert.match(made.result.stderr, /The margin was reduced to keep the stamp on the selected side of the image\./u);
    const image = pixels(made.image.output); const actual = bounds(image);
    const across = (image.width - mask.width) / 2; const down = (image.height - mask.height) / 2;
    const left = horizontal === "left" ? Math.floor(across) : Math.ceil(across);
    const top = vertical === "top" ? Math.floor(down) : Math.ceil(down);
    assert.deepEqual(actual, { left: left + ink.left, right: left + ink.right, top: top + ink.top, bottom: top + ink.bottom }, "actual stamp pixels stay at the selected center boundary");
}
const nothing = stamp("", { dateFormat: "iso-minutes", coordinateFormat: "decimal" });
assert.equal(nothing.result.status, 1); assert.equal(nothing.image.state, "nothing-to-stamp");
assert.match(nothing.image.reason, /^[A-Z].*\.$/u); assert.equal(fs.existsSync(path.join(nothing.folder, "photo_stamped.png")), false);
assert.deepEqual(fs.readFileSync(original), originalBytes);
console.log("macOS layout passed: mixed-direction full-line identity/left alignment, six margin pixel bounds and sentence reasons");
