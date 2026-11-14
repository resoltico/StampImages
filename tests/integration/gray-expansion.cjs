"use strict";
const { parseReceipt } = require("./lib/receipt.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const [artifact, work, baseConfig, profile] = process.argv.slice(2);
const input = path.join(work, "input"), scratch = path.join(work, "scratch");
fs.mkdirSync(input, { recursive: true }); fs.mkdirSync(scratch, { recursive: true });
const at = (name) => path.join(scratch, name);
const run = (tool, args) => execFileSync(tool, args.map(String), { stdio: ["ignore", "pipe", "pipe"] });
const vips = (...args) => run("vips", args);
const hash = (filename) => crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
const field = (filename, key) => run("vipsheader", ["-f", key, filename]).toString().trim();
const enumName = (text) => (/(?:VIPS_INTERPRETATION|VIPS_FORMAT)_(?<name>\w+)/u.exec(text)?.groups.name ?? text).toLowerCase().replace(/_/gu, "-");
const icc = (filename) => run("exiftool", ["-icc_profile", "-b", filename]);
const forms = [
    { name: "gray8.png", depth: "uchar", alpha: false, gray: true },
    { name: "gray16.png", depth: "ushort", alpha: false, gray: true },
    { name: "alpha8.png", depth: "uchar", alpha: true, gray: true },
    { name: "alpha16.png", depth: "ushort", alpha: true, gray: true },
    { name: "profiled16.tif", depth: "ushort", alpha: false, gray: true, tagged: true },
    { name: "rgb-looking-gray.png", depth: "uchar", alpha: false, gray: false }
];

function generate() {
    vips("black", at("black.v"), 400, 300);
    vips("linear", at("black.v"), at("gray8.v"), 0, 120, "--uchar");
    vips("linear", at("black.v"), at("deep-float.v"), 0, 40001);
    vips("cast", at("deep-float.v"), at("deep-cast.v"), "ushort");
    vips("copy", at("deep-cast.v"), at("gray16.v"), "--interpretation", "grey16");
    vips("linear", at("black.v"), at("alpha8.v"), 0, 128, "--uchar");
    vips("linear", at("black.v"), at("alpha-float.v"), 0, 32768);
    vips("cast", at("alpha-float.v"), at("alpha16.v"), "ushort");
    vips("bandjoin", `${at("gray8.v")} ${at("alpha8.v")}`, at("alpha-gray8.v"));
    vips("bandjoin", `${at("gray16.v")} ${at("alpha16.v")}`, at("alpha-gray16.v"));
    vips("bandjoin", `${at("gray8.v")} ${at("gray8.v")} ${at("gray8.v")}`, at("rgb.v"));
    for (const spec of forms) {
        const base = spec.gray ? `${spec.alpha ? "alpha-gray" : "gray"}${spec.depth === "ushort" ? 16 : 8}.v` : "rgb.v";
        const source = path.join(input, spec.name);
        const grayKind = spec.depth === "ushort" ? "grey16" : "b-w";
        vips("copy", at(base), source, "--interpretation", spec.gray ? grayKind : "srgb");
        if (spec.tagged) { run("exiftool", ["-overwrite_original", `-icc_profile<=${profile}`, source]); }
        spec.path = source; spec.hash = hash(source); spec.icc = icc(source);
    }
}

function expectedImage(spec, active) {
    if (!active || !spec.gray) { return spec.path; }
    const output = at("reference.v");
    if (spec.tagged) { vips("icc_transform", spec.path, output, "srgb", "--input-profile", profile, "--intent", "relative"); }
    else {
        vips("extract_band", spec.path, at("channel.v"), 0);
        const channels = [at("channel.v"), at("channel.v"), at("channel.v")];
        if (spec.alpha) { vips("extract_band", spec.path, at("alpha.v"), 1); channels.push(at("alpha.v")); }
        vips("bandjoin", channels.join(" "), output);
    }
    return output;
}

function maximumDifference(actual, expected, rectangle) {
    vips("crop", actual, at("actual.v"), ...rectangle);
    vips("crop", expected, at("expected.v"), ...rectangle);
    vips("subtract", at("actual.v"), at("expected.v"), at("difference.v"));
    vips("abs", at("difference.v"), at("absolute.v"));
    return Number(vips("max", at("absolute.v")).toString().trim().split(/\s+/u)[0]);
}

function chroma(output) {
    vips("crop", output, at("roi.v"), 200, 150, 200, 150);
    for (const [name, index] of [["red", 0], ["green", 1], ["blue", 2]]) { vips("extract_band", at("roi.v"), at(`${name}.v`), index); }
    const values = [];
    for (const second of ["green", "blue"]) {
        vips("subtract", at("red.v"), at(`${second}.v`), at("chroma-difference.v"));
        vips("abs", at("chroma-difference.v"), at("chroma-absolute.v"));
        values.push(Number(vips("max", at("chroma-absolute.v")).toString().trim().split(/\s+/u)[0]));
    }
    return Math.max(...values);
}

function verify(spec, record, active) {
    const { output } = record;
    const bands = Number(field(output, "bands"));
    assert.equal(record.state, "saved");
    assert.equal(record.expanded, spec.gray && bands >= 3, "receipt flag follows saved representation");
    assert.equal(bands, (active || !spec.gray ? 3 : 1) + (spec.alpha ? 1 : 0));
    assert.equal(enumName(field(output, "format")), spec.depth, "non8bit-derived gray precision is retained");
    const expected = expectedImage(spec, active);
    for (const rectangle of [[0, 0, 400, 150], [0, 150, 200, 150]]) {
        assert.equal(maximumDifference(output, expected, rectangle), 0, "every channel outside the stamp region is unchanged");
    }
    assert.ok(maximumDifference(output, expected, [200, 150, 200, 150]) > 0, "actual stamp pixels exist");
    const profileBytes = icc(output);
    if (spec.tagged && active) { assert.equal(profileBytes.subarray(16, 20).toString(), "RGB "); }
    else { assert.deepEqual(profileBytes, spec.icc, "neutral profile or untagged convention is retained"); }
    if (active) { assert.ok(chroma(output) > 0, "active color survives in actual stamped pixels"); }
    assert.equal(hash(spec.path), spec.hash);
}

generate();
const palettes = [
    { name: "neutral", textColor: "#FFFFFF", outlineColor: "#000000", outlineWidth: 2, active: false },
    { name: "red", textColor: "#FF3B30", outlineColor: "#000000", outlineWidth: 0, active: true },
    { name: "inactive-outline", textColor: "#FFFFFF", outlineColor: "#00FF00", outlineWidth: 0, active: false },
    { name: "green-outline", textColor: "#FFFFFF", outlineColor: "#00FF00", outlineWidth: 2, active: true }
];
for (const palette of palettes) {
    const settings = { ...JSON.parse(fs.readFileSync(baseConfig, "utf8")), textColor: palette.textColor, outlineColor: palette.outlineColor, outlineWidth: palette.outlineWidth };
    const config = path.join(work, `${palette.name}.json`); fs.writeFileSync(config, JSON.stringify(settings));
    const result = run("/usr/bin/osascript", ["-l", "JavaScript", artifact, "--", "--headless", config, input]);
    const receipt = parseReceipt(result.toString()); assert.equal(receipt.state, "complete"); assert.equal(receipt.images.length, forms.length);
    for (const spec of forms) { verify(spec, receipt.images.find(record => record.source === spec.path), palette.active); }
    console.log(JSON.stringify({ grayscalePalette: palette.name, records: forms.length, sourceDepthAlphaPixelsProfilesChecked: true }));
}
