"use strict";
const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TYPES = { byte: 1, ascii: 2, unsignedRational: 5, signedRational: 10 };
const DATE = "2024:07:15 18:42:10";
const FORMATS = ["jpg", "png", "tif", "webp", "heic", "avif"];
const CASES = [
        { name: "valid-sw", latitude: [[22, 1], [57, 1], [171, 25]], latitudeRef: "S", longitude: [[43, 1], [12, 1], [189, 5]], longitudeRef: "W" },
        { name: "missing-refs", latitudeRef: null, longitudeRef: null },
        { name: "bad-refs", latitudeRef: "X", longitudeRef: "Q" },
        { name: "minutes60", latitude: [[10, 1], [60, 1], [0, 1]] },
        { name: "zero-denominator", latitude: [[10, 0], [0, 1], [0, 1]] },
        { name: "signed-negative", latitude: [[-10, 1], [0, 1], [0, 1]], signed: true },
        { name: "wrong-count", latitude: [[10, 1], [0, 1]] },
        { name: "wrong-type", latitudeType: "ascii" },
        { name: "xmp-only-sw", latitude: null, xmp: ["22,57.114S", "43,12.63W"] },
        { name: "xmp-bad-ref", latitude: null, xmp: ["22,57.114X", "43,12.63Q"] },
        { name: "xmp-minutes60", latitude: null, xmp: ["10,60N", "20,0E"] },
        { name: "xmp-no-ref", latitude: null, xmp: ["22,57.114", "43,12.63"] },
        { name: "mixed", latitude: [[22, 1], [57, 1], [171, 25]], latitudeRef: "S", longitude: [[43, 1], [12, 1], [189, 5]], longitudeRef: "W", xmp: ["48,51.504N", "2,17.67E"] }
    ];
function ascii(id, text) {
    return { id, type: TYPES.ascii, count: Buffer.byteLength(text) + 1, data: Buffer.from(`${text}\0`) };
}
function rational(id, pairs, signed = false) {
    const data = Buffer.alloc(pairs.length * 8);
    for (const [index, [numerator, denominator]] of pairs.entries()) {
        data[signed ? "writeInt32LE" : "writeUInt32LE"](numerator, index * 8);
        data[signed ? "writeInt32LE" : "writeUInt32LE"](denominator, index * 8 + 4);
    }
    return { id, type: signed ? TYPES.signedRational : TYPES.unsignedRational, count: pairs.length, data };
}
function gpsEntries(spec) {
    return spec.latitude === null ? [] : [
        { id: 0, type: TYPES.byte, count: 4, data: Buffer.from([2, 3, 0, 0]) },
        ...spec.latitudeRef === null ? [] : [ascii(1, spec.latitudeRef ?? "N")],
        ...spec.latitudeType === "ascii" ? [ascii(2, "bad")] : [rational(2, spec.latitude ?? [[10, 1], [0, 1], [0, 1]], spec.signed)],
        ...spec.longitudeRef === null ? [] : [ascii(3, spec.longitudeRef ?? "E")],
        rational(4, spec.longitude ?? [[20, 1], [0, 1], [0, 1]])
    ];
}
function metadataDirectories(spec) {
    const date = spec.date === undefined ? DATE : spec.date;
    const capture = date === null ? [] : [ascii(0x9003, date)];
    const gps = gpsEntries(spec);
    const directories = [[], capture, gps];
    const pointer = (id, directory) => ({ id, type: 4, count: 1, directory });
    if (capture.length) { directories[0].push(pointer(0x8769, 1)); }
    if (gps.length) { directories[0].push(pointer(0x8825, 2)); }
    return directories;
}
// Offsets are TIFF-relative, or file-relative when a metadata block is appended
// to an existing TIFF. No decimal conversion precedes writing original fractions.
function exif(spec, baseOffset = 0) {
    const directories = metadataDirectories(spec);
    const positions = [];
    let size = 8;
    for (const entries of directories) { positions.push(size); size += 2 + entries.length * 12 + 4; }
    const values = [];
    for (const entries of directories) {
        for (const entry of entries) {
            if (entry.data?.length > 4) {
                if (size % 2) { size += 1; }
                entry.offset = size; values.push(entry); size += entry.data.length;
            }
        }
    }
    const bytes = Buffer.alloc(size);
    bytes.write("II"); bytes.writeUInt16LE(42, 2); bytes.writeUInt32LE(baseOffset + positions[0], 4);
    directories.forEach((entries, index) => {
        entries.sort((left, right) => left.id - right.id);
        bytes.writeUInt16LE(entries.length, positions[index]);
        entries.forEach((entry, ordinal) => {
            const at = positions[index] + 2 + ordinal * 12;
            bytes.writeUInt16LE(entry.id, at); bytes.writeUInt16LE(entry.type, at + 2); bytes.writeUInt32LE(entry.count, at + 4);
            if (entry.directory !== undefined) { bytes.writeUInt32LE(baseOffset + positions[entry.directory], at + 8); }
            else if (entry.offset === undefined) { entry.data.copy(bytes, at + 8); }
            else { bytes.writeUInt32LE(baseOffset + entry.offset, at + 8); }
        });
    });
    for (const entry of values) { entry.data.copy(bytes, entry.offset); }
    return { bytes, root: positions[0], rootCount: directories[0].length };
}
function installTiffMetadata(file, spec) {
    const original = fs.readFileSync(file);
    if (original.toString("ascii", 0, 2) !== "II" || original.readUInt16LE(2) !== 42) {
        throw new Error("Fixture encoder must produce classic little-endian TIFF.");
    }
    const root = original.readUInt32LE(4);
    const count = original.readUInt16LE(root), entries = [];
    for (let index = 0; index < count; index += 1) {
        const at = root + 2 + index * 12, id = original.readUInt16LE(at);
        if (id !== 0x8769 && id !== 0x8825) { entries.push(Buffer.from(original.subarray(at, at + 12))); }
    }
    const start = original.length + original.length % 2;
    const metadata = exif(spec, start);
    for (let index = 0; index < metadata.rootCount; index += 1) {
        const at = metadata.root + 2 + index * 12;
        entries.push(Buffer.from(metadata.bytes.subarray(at, at + 12)));
    }
    entries.sort((left, right) => left.readUInt16LE(0) - right.readUInt16LE(0));
    const next = start + metadata.bytes.length, table = Buffer.alloc(2 + entries.length * 12 + 4);
    table.writeUInt16LE(entries.length); entries.forEach((entry, index) => entry.copy(table, 2 + index * 12));
    table.writeUInt32LE(original.readUInt32LE(root + 2 + count * 12), 2 + entries.length * 12);
    const header = Buffer.from(original); header.writeUInt32LE(next, 4);
    fs.writeFileSync(file, Buffer.concat([header, ...original.length % 2 ? [Buffer.alloc(1)] : [], metadata.bytes, table]));
}
function xmp(latitude, longitude) {
    const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/">' +
        `<exif:GPSLatitude>${escape(latitude)}</exif:GPSLatitude><exif:GPSLongitude>${escape(longitude)}</exif:GPSLongitude>` +
        "</rdf:Description></rdf:RDF></x:xmpmeta>";
}
function writeFixture(directory, base, spec, options) {
    const { format, exiftool, run } = options;
    const block = path.join(directory, `${spec.name}.exif`), file = path.join(directory, `${spec.name}.${format}`);
    fs.copyFileSync(base, file);
    fs.writeFileSync(block, exif(spec).bytes);
    if (format === "tif") { installTiffMetadata(file, spec); }
    else { run([exiftool, "-overwrite_original", `-EXIF<=${block}`, file]); }
    if (spec.xmp) {
        const packet = path.join(directory, `${spec.name}.xmp`);
        fs.writeFileSync(packet, xmp(...spec.xmp));
        run([exiftool, "-overwrite_original", `-XMP<=${packet}`, file]);
    }
    return { name: spec.name, format, path: file, base };
}
function generateGpsFixtures(directory, options = {}) {
    const { vips = "vips", exiftool = "exiftool", formats = FORMATS } = options;
    if (fs.existsSync(directory) && fs.readdirSync(directory).length) { throw new Error("Fixture directory must be new or empty."); }
    if (formats.some(format => !FORMATS.includes(format))) { throw new Error("Unsupported fixture format."); }
    fs.mkdirSync(directory, { recursive: true });
    const commands = [];
    function run(command) {
        const result = spawnSync(command[0], command.slice(1), { encoding: "utf8", timeout: 20000, env: { ...process.env, LC_ALL: "C", VIPS_CONCURRENCY: "2" } });
        const record = { command, exit: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
        commands.push(record);
        if (result.status !== 0) { throw new Error(JSON.stringify(record)); }
    }
    const black = path.join(directory, "black.v"), canvas = path.join(directory, "canvas.png"), color = path.join(directory, "color.v");
    run([vips, "black", black, "900", "600", "--bands", "3"]);
    run([vips, "linear", black, color, "1 1 1", "31 79 151", "--uchar"]);
    run([vips, "copy", color, canvas, "--interpretation", "srgb"]);

    const bases = [], files = [];
    const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    for (const format of formats) {
        const base = path.join(directory, `base.${format}`);
        run([vips, "copy", canvas, base + (["jpg", "webp", "heic", "avif"].includes(format) ? "[Q=90]" : "")]);
        const before = hash(base);
        for (const spec of CASES) {
            files.push(writeFixture(directory, base, spec, { format, exiftool, run }));
        }
        bases.push({ format, path: base, before, after: hash(base) });
    }
    return { files, bases, commands };
}
module.exports = { generateGpsFixtures };
