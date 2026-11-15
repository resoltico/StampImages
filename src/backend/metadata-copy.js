"use strict";
const { OperationError } = require("../core/errors.js");
const { METADATA_COPY_PROGRAM } = require("./metadata-copy-program.js");
const { projectionArgv, readProjection } = require("./metadata-projection.js");

// Standard capture groups, excluding source storage/preview/geometry and maker
// structures. Raw GPS is queued separately by the checked native program.
const CAPTURE_SELECTORS = ["ExifIFD:All", "IFD0:Make", "IFD0:Model", "IFD0:Artist", "IFD0:Copyright", "IFD0:Software", "IFD0:ImageDescription", "IFD0:ModifyDate",
    "-MakerNotes", "-Orientation", "-ImageWidth", "-ImageHeight", "-ExifImageWidth", "-ExifImageHeight", "-ThumbnailImage", "-PreviewImage", "*:*<XMP:All", "-XMP:GPS*"];
const SDR_METADATA = ["XMP-GContainer:All=", "XMP-hdrgm:All=", "XMP-HDRGainMap:All=", "XMP-hdr:All=", "XMP-apdi:All=", "XMP-tiff:Orientation="];
// The target is a fresh private Vips render of this captured source, never an
// unrelated existing image. Pixels and rendered profile remain target-owned.
function buildMetadataCopyArgv(exiftool, source, target, size) {
    if (!size || !Number.isSafeInteger(size.width) || size.width < 1 || !Number.isSafeInteger(size.height) || size.height < 1) {
        throw new TypeError("Metadata copy requires positive whole pixel dimensions.");
    }
    const assignments = ["IFD0:Orientation#=1", `ExifIFD:ExifImageWidth=${size.width}`, `ExifIFD:ExifImageHeight=${size.height}`,
        `XMP-tiff:ImageWidth=${size.width}`, `XMP-tiff:ImageHeight=${size.height}`,
        `XMP-exif:ExifImageWidth=${size.width}`, `XMP-exif:ExifImageHeight=${size.height}`, ...SDR_METADATA];
    const program = METADATA_COPY_PROGRAM.replace("@@CAPTURE_SELECTORS@@", CAPTURE_SELECTORS.map((tag) => JSON.stringify(tag)).join(","))
        .replace("@@ASSIGNMENTS@@", assignments.map((assignment) => JSON.stringify(assignment)).join(","));
    return projectionArgv(exiftool, source, program, [`source=${source}`, `target=${target}`]);
}
const COUNTS = ["GPSInputCount", "RequiredSetCount", "FailureCount"];
const TEXT_NOTICES = ["TargetReadWarning", "SourceReadNotice", "SourceReaderViewNotice", "SourceReaderViewOperationNotice", "TargetIPTCWriteNotice"];
const FIELDS = ["ExifToolVersion", "TargetFile", "WriteStatus", "RawWriteStatus", "VerifiedGPS", "RebuiltTargetWebPExif", "FailureText", ...COUNTS, ...TEXT_NOTICES, "ExcludedSourceReaderGroups", "PreservedEmptyTargetMakerNotes"];
function count(value) {
    return typeof value === "string" && /^\d+$/u.test(value) && Number.isSafeInteger(Number(value));
}
function invalidPacket() { return new OperationError("ExifTool did not return a complete checked metadata-copy result."); }
function checkPacket(packet, target) {
    if (packet.TargetFile !== target || Object.keys(packet).some((key) => !FIELDS.includes(key)) ||
        COUNTS.some((key) => !count(packet[key])) || typeof packet.FailureText !== "string" ||
        !["0", "1", "2"].includes(packet.WriteStatus) || !["0", "1", "2"].includes(packet.RawWriteStatus) ||
        !["0", "1"].includes(packet.VerifiedGPS) || !["0", "1"].includes(packet.RebuiltTargetWebPExif)) {
        throw invalidPacket();
    }
}
function checkOptionalFields(packet, success) {
    for (const key of TEXT_NOTICES) {
        if (Object.hasOwn(packet, key) && (typeof packet[key] !== "string" || packet[key].trim() === "")) { throw invalidPacket(); }
    }
    const groups = packet.ExcludedSourceReaderGroups;
    if (Object.hasOwn(packet, "ExcludedSourceReaderGroups") && (!Array.isArray(groups) || groups.length === 0 ||
        new Set(groups).size !== groups.length || groups.some((group) => !["ICC_Profile", "MakerNotes"].includes(group)))) { throw invalidPacket(); }
    if (Object.hasOwn(packet, "PreservedEmptyTargetMakerNotes") && (!success || !count(packet.PreservedEmptyTargetMakerNotes) || Number(packet.PreservedEmptyTargetMakerNotes) === 0)) { throw invalidPacket(); }
}
function metadataCopyResult(output, source, target) {
    const packet = readProjection(output, source);
    checkPacket(packet, target);
    const success = ["1", "2"].includes(packet.WriteStatus) && packet.RawWriteStatus === packet.WriteStatus && packet.VerifiedGPS === "1" &&
        packet.FailureCount === "0" && Number(packet.RequiredSetCount) > 0 && packet.FailureText === "";
    checkOptionalFields(packet, success);
    if (!success) { throw new OperationError(packet.FailureText.trim() || "The copied metadata could not be written and verified."); }
    // Private notices never escape to core. This fact comes from the actual
    // post-write GPS equality proof, including incomplete/invalid GPS metadata.
    return { locationRetained: Number(packet.GPSInputCount) > 0 };
}
module.exports = { buildMetadataCopyArgv, metadataCopyResult };
