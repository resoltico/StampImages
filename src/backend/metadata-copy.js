"use strict";

// Copy standard capture fields without source TIFF storage, previews or geometry.
// Preserve existing target metadata outside these selections, including maker data.
const CAPTURE_TAGS = ["-ExifIFD:All", "-GPS:All", "-IFD0:Make", "-IFD0:Model", "-IFD0:Artist", "-IFD0:Copyright", "-IFD0:Software", "-IFD0:ImageDescription", "-IFD0:ModifyDate",
    "--MakerNotes", "--Orientation", "--ImageWidth", "--ImageHeight", "--ExifImageWidth", "--ExifImageHeight", "--ThumbnailImage", "--PreviewImage", "-XMP:All", "-IPTC:All"];
const SDR_METADATA = ["-XMP-GContainer:All=", "-XMP-hdrgm:All=", "-XMP-HDRGainMap:All=", "-XMP-hdr:All=", "-XMP-apdi:All=", "-XMP-tiff:Orientation="];
function buildMetadataCopyArgv(exiftool, source, target, size) {
    return [exiftool, "-overwrite_original", "-TagsFromFile", source, ...CAPTURE_TAGS, "-IFD0:Orientation#=1",
        `-ExifIFD:ExifImageWidth=${size.width}`, `-ExifIFD:ExifImageHeight=${size.height}`,
        `-XMP-tiff:ImageWidth=${size.width}`, `-XMP-tiff:ImageHeight=${size.height}`,
        `-XMP-exif:ExifImageWidth=${size.width}`, `-XMP-exif:ExifImageHeight=${size.height}`, ...SDR_METADATA, target];
}
module.exports = { buildMetadataCopyArgv };
