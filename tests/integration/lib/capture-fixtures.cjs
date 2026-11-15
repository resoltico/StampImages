"use strict";
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");

function ifdEntry(tag, type, count, value) {
    const entry = Buffer.alloc(12);
    entry.writeUInt16LE(tag, 0); entry.writeUInt16LE(type, 2); entry.writeUInt32LE(count, 4);
    if (Buffer.isBuffer(value)) { value.copy(entry, 8); } else { entry.writeUInt32LE(value, 8); }
    return entry;
}
function shortPair(first, second = 0) {
    const bytes = Buffer.alloc(4); bytes.writeUInt16LE(first); bytes.writeUInt16LE(second, 2); return bytes;
}
function uints(...numbers) {
    const bytes = Buffer.alloc(numbers.length * 4);
    numbers.forEach((number, index) => bytes.writeUInt32LE(number, index * 4)); return bytes;
}
function ifd(entries) { const count = Buffer.alloc(2); count.writeUInt16LE(entries.length); return Buffer.concat([count, ...entries, uints(0)]); }
function nikonFixture(jpeg, { iso = 400, depth = 16, badScan = false } = {}) {
    // The valid Scan IFD is outside the declared 60-byte maker block. Vips
    // relocates that block without this directory; ExifTool must fix its offsets.
    const maker = Buffer.concat([Buffer.from("Nikon\0\x02\0\0\0II*\0", "binary"), uints(8), ifd([
        ifdEntry(1, 7, 4, Buffer.from("0210")), ifdEntry(2, 3, 2, shortPair(0, iso)), ifdEntry(0xe10, 4, 1, badScan ? 999999 : 50)
    ])]);
    const scan = ifd([ifdEntry(0x41, 3, 1, shortPair(depth))]);
    const comment = Buffer.from(`ASCII\0\0\0${"Generated capture sentinel ".repeat(8)}`);
    const gpsAt = 218 + comment.length;
    const gps = Buffer.concat([ifd([
        ifdEntry(0, 1, 4, Buffer.from([2, 3, 0, 0])), ifdEntry(1, 2, 2, Buffer.from("N\0\0\0")),
        ifdEntry(2, 5, 3, gpsAt + 66), ifdEntry(3, 2, 2, Buffer.from("E\0\0\0")), ifdEntry(4, 5, 3, gpsAt + 90)
    ]), uints(12, 1, 1, 2, 3, 4), uints(34, 1, 5, 6, 7, 8)]);
    const tiff = Buffer.concat([Buffer.from("II*\0", "binary"), uints(8), ifd([
        ifdEntry(0x10f, 2, 6, 62), ifdEntry(0x110, 2, 10, 68), ifdEntry(0x8769, 4, 1, 78), ifdEntry(0x8825, 4, 1, gpsAt)
    ]), Buffer.from("NIKON\0Generated\0"), ifd([
        ifdEntry(0x9003, 2, 20, 120), ifdEntry(0x927c, 7, 60, 140), ifdEntry(0x9286, 7, comment.length, 218)
    ]), Buffer.from("2024:07:14 18:32:05\0"), maker, scan, comment, gps]);
    const payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
    const header = Buffer.from([0xff, 0xe1, 0, 0]); header.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([jpeg.subarray(0, 2), header, payload, jpeg.subarray(2)]);
}
function iimRecord(set, id, value) {
    const bytes = Buffer.from(value); const header = Buffer.from([0x1c, set, id, 0, 0]); header.writeUInt16BE(bytes.length, 3);
    return Buffer.concat([header, bytes]);
}
function iptcPacket() {
    return Buffer.concat([iimRecord(1, 90, Buffer.from([0x1b, 0x25, 0x47])), iimRecord(2, 5, "Generated IPTC"),
        iimRecord(2, 55, "20240715"), iimRecord(2, 60, "134742"), iimRecord(2, 120, "Own network-free legacy time fixture")]);
}
function jpegWithoutExif(file) {
    const bytes = fs.readFileSync(file), pieces = [bytes.subarray(0, 2)];
    let offset = 2;
    while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { throw new Error("Generated JPEG has an invalid marker boundary."); }
        const marker = bytes[offset + 1];
        if (marker === 0xda || marker === 0xd9) { pieces.push(bytes.subarray(offset)); break; }
        const end = offset + 2 + bytes.readUInt16BE(offset + 2);
        if (end > bytes.length || end <= offset + 3) { throw new Error("Generated JPEG has an invalid segment length."); }
        if (marker !== 0xe1 || bytes.subarray(offset + 4, offset + 10).toString("binary") !== "Exif\0\0") { pieces.push(bytes.subarray(offset, end)); }
        offset = end;
    }
    return Buffer.concat(pieces);
}
function writeNikonFixtures(directory, cleanJpeg) {
    const jpeg = jpegWithoutExif(cleanJpeg);
    return Object.fromEntries(Object.entries({ source: {}, asymmetric: { iso: 800, depth: 8 }, bad: { badScan: true } }).map(([name, options]) => {
        const file = path.join(directory, `nikon-${name}.jpg`); fs.writeFileSync(file, nikonFixture(jpeg, options)); return [name, file];
    }));
}
function writeMalformedIccFixture(cleanJpeg, target) {
    const jpeg = fs.readFileSync(cleanJpeg);
    const payload = Buffer.concat([Buffer.from("ICC_PROFILE\0\x01\x01", "binary"), Buffer.alloc(16)]);
    const segment = Buffer.alloc(payload.length + 4); segment[0] = 0xff; segment[1] = 0xe2;
    segment.writeUInt16BE(payload.length + 2, 2); payload.copy(segment, 4);
    fs.writeFileSync(target, Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]));
    return target;
}
module.exports = { iptcPacket, writeNikonFixtures, writeMalformedIccFixture };
