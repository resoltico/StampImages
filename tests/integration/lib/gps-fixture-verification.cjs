"use strict";
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
// Independent literal expected wire/readback specs, not generator output specs.
const expected = {
    "valid-sw": { latitude: "22/1 57/1 171/25", longitude: "43/1 12/1 189/5", latitudeRef: "S", longitudeRef: "W", format: "rational64u", count: 3 },
    "missing-refs": { latitude: "10/1 0/1 0/1", longitude: "20/1 0/1 0/1", format: "rational64u", count: 3 },
    "bad-refs": { latitude: "10/1 0/1 0/1", longitude: "20/1 0/1 0/1", latitudeRef: "X", longitudeRef: "Q", format: "rational64u", count: 3 },
    minutes60: { latitude: "10/1 60/1 0/1", longitude: "20/1 0/1 0/1", latitudeRef: "N", longitudeRef: "E", format: "rational64u", count: 3 },
    "zero-denominator": { latitude: "10/0 0/1 0/1", longitude: "20/1 0/1 0/1", latitudeRef: "N", longitudeRef: "E", format: "rational64u", count: 3 },
    "signed-negative": { latitude: "-10/1 0/1 0/1", longitude: "20/1 0/1 0/1", latitudeRef: "N", longitudeRef: "E", format: "rational64s", count: 3 },
    "wrong-count": { latitude: "10/1 0/1", longitude: "20/1 0/1 0/1", latitudeRef: "N", longitudeRef: "E", format: "rational64u", count: 2 },
    "wrong-type": { raw: "bad", longitude: "20/1 0/1 0/1", latitudeRef: "N", longitudeRef: "E", format: "string", count: 4 },
    "xmp-only-sw": { xmpLatitude: "22,57.114S", xmpLongitude: "43,12.63W" },
    "xmp-bad-ref": { xmpLatitude: "22,57.114X", xmpLongitude: "43,12.63Q" },
    "xmp-minutes60": { xmpLatitude: "10,60N", xmpLongitude: "20,0E" },
    "xmp-no-ref": { xmpLatitude: "22,57.114", xmpLongitude: "43,12.63" },
    mixed: { latitude: "22/1 57/1 171/25", longitude: "43/1 12/1 189/5", latitudeRef: "S", longitudeRef: "W", format: "rational64u", count: 3, xmpLatitude: "48,51.504N", xmpLongitude: "2,17.67E" }
};
const projection = String.raw`my $r=Image::ExifTool->new;$r->Options(SaveFormat=>1,SaveBin=>1);$r->ExtractInfo($self->Options('UserParam','source'));$_={};for my $f (['date','DateTimeOriginal','Raw'],['latitude','EXIF:GPSLatitude','Rational'],['longitude','EXIF:GPSLongitude','Rational'],['latitudeRef','EXIF:GPSLatitudeRef','Raw'],['longitudeRef','EXIF:GPSLongitudeRef','Raw'],['raw','EXIF:GPSLatitude','Raw'],['xmpLatitude','XMP:GPSLatitude','Raw'],['xmpLongitude','XMP:GPSLongitude','Raw']){my $v=scalar($r->GetValue($f->[1],$f->[2]));$_->{$f->[0]}=$v if defined($v)}for my $tag($r->GetFoundTags){if(Image::ExifTool::GetTagName($tag) eq 'GPSLatitude' && $r->GetGroup($tag,0) eq 'EXIF'){$_->{format}=$r->GetGroup($tag,6);my $v=scalar($r->GetValue($tag,'Bin'));$v=$$v if ref($v)eq'SCALAR';$_->{binaryHex}=unpack('H*',$v) if defined($v)&&!ref($v);}}`;
function nativeRun(commands) {
    return (command, binary = false) => {
        const result = spawnSync(command[0], command.slice(1), { encoding: binary ? undefined : "utf8", timeout: 20000, env: { ...process.env, LC_ALL: "C", VIPS_CONCURRENCY: "2" } });
        commands.push({ command, exit: result.status, signal: result.signal, stdout: binary ? "<binary>" : result.stdout, stderr: binary ? String(result.stderr) : result.stderr });
        assert.equal(result.status, 0, JSON.stringify(commands.at(-1)));
        return result.stdout;
    };
}
function decodedHash(file, run, directory, vips) {
    const raw = path.join(directory, "pixels.raw");
    run([vips, "rawsave", file, raw]);
    const hash = createHash("sha256").update(fs.readFileSync(raw)).digest("hex");
    fs.unlinkSync(raw);
    return hash;
}
function tiffReader(bytes) {
    const little = bytes.toString("ascii", 0, 2) === "II";
    assert(little || bytes.toString("ascii", 0, 2) === "MM");
    const word = offset => little ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset);
    const long = offset => little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
    assert.equal(word(2), 42);
    function entry(directoryOffset, id) {
        const size = word(directoryOffset);
        assert(size < 1000);
        for (let index = 0; index < size; index += 1) {
            const at = directoryOffset + 2 + index * 12;
            if (word(at) === id) {
                const type = word(at + 2);
                const count = long(at + 4);
                const units = { 1: 1, 2: 1, 5: 8, 10: 8 }[type];
                const length = units ? count * units : 4;
                const offset = length <= 4 ? at + 8 : long(at + 8);
                assert(offset + length <= bytes.length);
                return { type, count, offset, hex: bytes.subarray(offset, offset + length).toString("hex") };
            }
        }
        return null;
    }
    return { entry, long };
}
function physicalGps(file, run, exiftool) {
    const physical = fs.readFileSync(file.path);
    const bytes = file.format === "tif" ? physical : run([exiftool, "-EXIF", "-b", file.path], true);
    assert(physical.indexOf(bytes) >= 0, "raw EXIF must match actual container bytes");
    const { entry, long } = tiffReader(bytes);
    const pointer = entry(long(4), 0x8825);
    if (!pointer) { return null; }
    const gps = long(pointer.offset);
    return { latitude: entry(gps, 2), longitude: entry(gps, 4), latitudeRef: entry(gps, 1), longitudeRef: entry(gps, 3) };
}
function verifyBinary(file, record, spec) {
    if (!spec.count) { return; }
    const bytes = Buffer.from(record.binaryHex, "hex");
    assert.equal(bytes.length, spec.format === "string" ? 4 : spec.count * 8);
    if (file.name === "zero-denominator") {
        assert.equal(bytes.readUInt32LE(), 10);
        assert.equal(bytes.readUInt32LE(4), 0);
    }
    if (file.name === "minutes60") { assert.equal(bytes.readUInt32LE(8), 60); }
    if (file.name === "signed-negative") { assert.equal(bytes.readInt32LE(), -10); }
}
function verifyPhysical(physical, record, spec) {
    if (!spec.format) {
        assert.equal(physical, null, "XMP-only fixture must not invent EXIF refs/GPS");
        return;
    }
    assert(physical);
    assert.equal(physical.latitude.type, { string: 2, rational64u: 5, rational64s: 10 }[spec.format]);
    assert.equal(physical.latitude.count, spec.count);
    assert.equal(physical.latitude.hex, record.binaryHex);
    for (const field of ["latitudeRef", "longitudeRef"]) {
        if (spec[field]) { assert.equal(Buffer.from(physical[field].hex, "hex").toString().replace(/\0$/u, ""), spec[field]); }
        else { assert.equal(physical[field], null); }
    }
}
function verifyRecord(file, record) {
    const spec = expected[file.name];
    assert(spec, `Unknown fixture case: ${file.name}`);
    assert.equal(record.date, "2024:07:15 18:42:10");
    for (const key of ["latitude", "longitude", "latitudeRef", "longitudeRef", "format", "xmpLatitude", "xmpLongitude"]) {
        assert.equal(record[key], spec[key], `${file.name}.${file.format} ${key}`);
    }
    if (spec.raw) { assert.equal(record.raw, spec.raw); }
    verifyBinary(file, record, spec);
    return spec;
}
function readGpsRecord(file, run, exiftool) {
    const output = JSON.parse(run([exiftool, "-json", "-api", "StructFormat=JSONQ", "-api", `Filter=${projection}`, "-userParam", `source=${file.path}`, "-System:FileName", file.path]));
    assert.equal(output.length, 1);
    assert.equal(output[0].SourceFile, file.path);
    return output[0].FileName;
}
function verifyFixture(file, context) {
    const { directory, exiftool, pixels, run, vips } = context;
    const record = readGpsRecord(file, run, exiftool);
    const spec = verifyRecord(file, record);
    const physical = physicalGps(file, run, exiftool);
    verifyPhysical(physical, record, spec);
    const hash = decodedHash(file.path, run, directory, vips);
    assert.equal(hash, pixels.get(file.base), "metadata must not alter encoded-image pixels");
    return { ...file, readback: record, physical, pixels: hash };
}
function verifyBases(manifest) {
    const count = Object.keys(expected).length;
    assert.equal(manifest.files.length, manifest.bases.length * count, "Fixture manifest must include every expected case.");
    for (const base of manifest.bases) {
        const hash = createHash("sha256").update(fs.readFileSync(base.path)).digest("hex");
        assert.equal(base.before, base.after, "source base changed during generation");
        assert.equal(hash, base.before, "encoded source base changed since generation");
        const names = manifest.files.filter(file => file.base === base.path).map(file => file.name).sort();
        assert.deepEqual(names, Object.keys(expected).sort(), "each format needs every independent expected case once");
    }
}
function verifyGpsFixtures(manifest, { vips = "vips", exiftool = "exiftool" } = {}) {
    verifyBases(manifest);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gps-fixture-verify-"));
    const commands = [], run = nativeRun(commands);
    try {
        const pixels = new Map(manifest.bases.map(base => [base.path, decodedHash(base.path, run, directory, vips)]));
        const rows = manifest.files.map(file => verifyFixture(file, { directory, exiftool, pixels, run, vips }));
        verifyBases(manifest);
        return { bases: manifest.bases, rows, commands };
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
module.exports = { verifyGpsFixtures, readGpsRecord, decodedHash };
