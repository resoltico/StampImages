"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { buildMetadataCopyArgv, metadataCopyResult } = require("../../../src/backend/metadata-copy.js");
const { OperationError } = require("../../../src/core/errors.js");
const source = "/owned/source.tif";
const target = "/owned/copy.tif";
function packet(changes = {}, envelope = {}) {
    return JSON.stringify([{ SourceFile: source, FileName: { ExifToolVersion: "13.55", TargetFile: target,
        WriteStatus: "1", RawWriteStatus: "1", VerifiedGPS: "1", GPSInputCount: "0", RequiredSetCount: "13",
        FailureCount: "0", FailureText: "", RebuiltTargetWebPExif: "0", ...changes }, ...envelope }]);
}
test("all-format capture copy uses raw checked setters while replacing target geometry and SDR metadata", () => {
    const argv = buildMetadataCopyArgv("/v/exiftool", source, target, { width: 600, height: 400 });
    assert.deepEqual(argv.slice(0, 6), ["/v/exiftool", "-json", "-api", "StructFormat=JSONQ", "-api", "SaveFormat=1"]);
    assert.deepEqual(argv.slice(-6), ["-userParam", `source=${source}`, "-userParam", `target=${target}`, "-System:FileName", source]);
    const program = argv.find((value) => value.startsWith("Filter="));
    const selectors = /my @captureSelectors=\((?<items>[^;]+)\);/u.exec(program);
    assert.deepEqual(JSON.parse(`[${selectors.groups.items}]`), ["ExifIFD:All", "IFD0:Make", "IFD0:Model", "IFD0:Artist", "IFD0:Copyright", "IFD0:Software", "IFD0:ImageDescription", "IFD0:ModifyDate",
        "-MakerNotes", "-Orientation", "-ImageWidth", "-ImageHeight", "-ExifImageWidth", "-ExifImageHeight", "-ThumbnailImage", "-PreviewImage", "*:*<XMP:All", "-XMP:GPS*"]);
    const assignments = /for my \$assignment \((?<items>[^)]+)\)/u.exec(program);
    assert.deepEqual(JSON.parse(`[${assignments.groups.items}]`), ["IFD0:Orientation#=1", "ExifIFD:ExifImageWidth=600", "ExifIFD:ExifImageHeight=400", "XMP-tiff:ImageWidth=600", "XMP-tiff:ImageHeight=400", "XMP-exif:ExifImageWidth=600", "XMP-exif:ExifImageHeight=400",
        "XMP-GContainer:All=", "XMP-hdrgm:All=", "XMP-HDRGainMap:All=", "XMP-hdr:All=", "XMP-apdi:All=", "XMP-tiff:Orientation="]);
    assert.ok(program.includes("TargetFile=>$dst")); assert.ok(program.includes("WriteInfo($dst)"));
    assert.doesNotMatch(program, /@@|NEGATIVE_SKIP_LATITUDE/u);
    assert.equal(argv.includes("-TagsFromFile"), false);
});
test("the assembled native program declares its callbacks and has no missing-module interpolation", () => {
    const argv = buildMetadataCopyArgv("/exiftool", source, target, { width: 600, height: 400 });
    const program = argv.find((value) => value.startsWith("Filter="));
    function closedCallbacks(text) {
        assert.doesNotMatch(text, /\bundefined\b/u);
        const callbacks = new Set([...text.matchAll(/(?<callback>\$[a-z_]\w*)->\(/giu)].map((match) => match.groups.callback));
        assert.ok(callbacks.size > 0);
        for (const callback of callbacks) { assert.match(text, new RegExp(`\\bmy\\s+\\${callback}\\b`, "u")); }
    }
    closedCallbacks(program);
    closedCallbacks("my $callback=sub {}; $callback->();");
    assert.throws(() => closedCallbacks("$callback->();"), assert.AssertionError, "a removed declaration breaks composition");
    assert.throws(() => closedCallbacks("undefined"), assert.AssertionError, "a missing export cannot become native program text");
});
test("source and target spelling stay data, never native program interpolation", () => {
    const original = "/a/'\"$()\\\nsource.jpg";
    const copy = "/b/'\"$()\\\ncopy.png";
    const argv = buildMetadataCopyArgv("/tool path/exiftool", original, copy, { width: 8, height: 9 });
    const program = argv.find((value) => value.startsWith("Filter="));
    assert.equal(program.includes(original), false); assert.equal(program.includes(copy), false);
    assert.ok(argv.includes(`source=${original}`)); assert.ok(argv.includes(`target=${copy}`)); assert.equal(argv.at(-1), original);
});
test("metadata geometry accepts only positive safe whole pixel dimensions", () => {
    assert.doesNotThrow(() => buildMetadataCopyArgv("/e", source, target, { width: 1, height: 1 }));
    for (const size of [null, {}, { width: 0, height: 1 }, { width: 1, height: 0 }, { width: -1, height: 1 }, { width: 1, height: -1 }, { width: 1.5, height: 1 }, { width: 1, height: 1.5 }, { width: "1", height: 1 }, { width: 1, height: "1" }, { width: Infinity, height: 1 }, { width: 1, height: Number.MAX_SAFE_INTEGER + 1 }]) {
        assert.throws(() => buildMetadataCopyArgv("/e", source, target, size), { name: "TypeError", message: "Metadata copy requires positive whole pixel dimensions." });
    }
});
test("only checked successful native writes expose the retained-location fact", () => {
    assert.deepEqual(metadataCopyResult(packet(), source, target), { locationRetained: false });
    for (const status of ["1", "2"]) {
        assert.deepEqual(metadataCopyResult(packet({ WriteStatus: status, RawWriteStatus: status, GPSInputCount: "4" }), source, target), { locationRetained: true });
    }
});
test("native status zero and post-write GPS mismatch refuse despite process success", () => {
    for (const changes of [
        { WriteStatus: "0", RawWriteStatus: "0", VerifiedGPS: "0", FailureCount: "1", FailureText: "Could not queue required GPS." },
        { WriteStatus: "0", RawWriteStatus: "1", VerifiedGPS: "0", FailureCount: "1", FailureText: "Raw GPS read-back differs." }
    ]) { assert.throws(() => metadataCopyResult(packet(changes), source, target), new RegExp(changes.FailureText, "u")); }
});
test("write/readback/setter failures cannot hide behind inconsistent success fields", () => {
    for (const changes of [{ RawWriteStatus: "0" }, { VerifiedGPS: "0" }, { FailureCount: "1" }, { RequiredSetCount: "0" }, { FailureText: "Unexpected diagnostic" }]) {
        assert.throws(() => metadataCopyResult(packet(changes), source, target), OperationError);
    }
});
test("wrong or missing target echo and wrong source association are refused", () => {
    for (const changes of [{ TargetFile: "/other.png" }, { TargetFile: undefined }]) {
        assert.throws(() => metadataCopyResult(packet(changes), source, target), OperationError);
    }
    assert.throws(() => metadataCopyResult(packet({}, { SourceFile: "/other.jpg" }), source, target), OperationError);
});
test("private notices remain private, including a failed attempted reader view without adopted groups", () => {
    const notices = { TargetIPTCWriteNotice: "Own same-format PNG packet restoration.", TargetReadWarning: "Known target wrapper.", SourceReadNotice: "Known source wrapper.", ExcludedSourceReaderGroups: ["ICC_Profile", "MakerNotes"],
        SourceReaderViewNotice: "Original excluded-group diagnostics.", SourceReaderViewOperationNotice: "Own view operation notice.", PreservedEmptyTargetMakerNotes: "1", RebuiltTargetWebPExif: "1", GPSInputCount: "4" };
    assert.deepEqual(metadataCopyResult(packet(notices), source, target), { locationRetained: true });
    const failed = packet({ WriteStatus: "0", RawWriteStatus: "0", VerifiedGPS: "0", FailureCount: "1", FailureText: "View failed.", SourceReaderViewOperationNotice: "Own attempted view notice." });
    assert.throws(() => metadataCopyResult(failed, source, target), /View failed/u);
});
test("malformed private fields cannot become successful metadata receipts", () => {
    const invalid = ["", "-1", "1 ", "1.5", " 1", "Infinity", "9007199254740992", 1, null];
    for (const field of ["GPSInputCount", "RequiredSetCount", "FailureCount"]) {
        for (const value of invalid) { assert.throws(() => metadataCopyResult(packet({ [field]: value }), source, target), OperationError); }
    }
    for (const changes of [{ WriteStatus: undefined }, { RawWriteStatus: "3" }, { VerifiedGPS: true }, { RebuiltTargetWebPExif: "2" }, { FailureText: null }, { Unknown: "secret" },
        { TargetIPTCWriteNotice: 1 }, { TargetIPTCWriteNotice: " " }, { SourceReadNotice: " " }, { TargetReadWarning: 1 }, { SourceReaderViewNotice: "" }, { SourceReaderViewOperationNotice: null },
        { ExcludedSourceReaderGroups: [] }, { ExcludedSourceReaderGroups: "ICC_Profile" }, { ExcludedSourceReaderGroups: ["ICC_Profile", "ICC_Profile"] }, { ExcludedSourceReaderGroups: ["Other"] }, { ExcludedSourceReaderGroups: ["ICC_Profile", "Other"] },
        { PreservedEmptyTargetMakerNotes: "0" }, { PreservedEmptyTargetMakerNotes: 1 }, { PreservedEmptyTargetMakerNotes: "1", WriteStatus: "0" }]) {
        assert.throws(() => metadataCopyResult(packet(changes), source, target), OperationError);
    }
});

test("malformed native packets stay expected tool errors with a useful diagnosis", () => {
    assert.throws(() => metadataCopyResult(packet({ TargetFile: "wrong" }), source, target), { name: "OperationError", message: "ExifTool did not return a complete checked metadata-copy result." });
    assert.throws(() => metadataCopyResult(packet({ WriteStatus: "0", RawWriteStatus: "0", VerifiedGPS: "0", FailureText: "  Reason left by the writer.  ", FailureCount: "1" }), source, target),
        { name: "OperationError", message: "Reason left by the writer." });
    assert.throws(() => metadataCopyResult(packet({ VerifiedGPS: "0" }), source, target), { name: "OperationError", message: "The copied metadata could not be written and verified." });
});
