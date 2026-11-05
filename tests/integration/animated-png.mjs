// A two-frame RGB APNG built from the PNG/APNG chunk contract, independent of libvips.
import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const [, , output] = process.argv;
function word(value) { const data = Buffer.alloc(4); data.writeUInt32BE(value); return data; }
function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) { crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const payload = Buffer.concat([Buffer.from(type), data]);
    return Buffer.concat([word(data.length), payload, word(crc32(payload))]);
}
function frame(sequence) {
    const data = Buffer.alloc(26);
    data.writeUInt32BE(sequence); data.writeUInt32BE(2, 4); data.writeUInt32BE(2, 8);
    data.writeUInt16BE(1, 20); data.writeUInt16BE(10, 22);
    return chunk("fcTL", data);
}
const header = Buffer.concat([word(2), word(2), Buffer.from([8, 2, 0, 0, 0])]);
const red = deflateSync(Buffer.from([0, 255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255, 0, 0]));
const blue = deflateSync(Buffer.from([0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255]));
await writeFile(output, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
    chunk("acTL", Buffer.concat([word(2), word(0)])), frame(0), chunk("IDAT", red), frame(1),
    chunk("fdAT", Buffer.concat([word(2), blue])), chunk("IEND", Buffer.alloc(0))]));
