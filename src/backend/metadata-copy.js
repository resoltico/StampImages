"use strict";

// uhdrload omits XMP/IPTC. Copy those from the captured source, then remove
// HDR rendering/container declarations from the standard-range stamped copy.
function buildMetadataCopyArgv(exiftool, source, target) {
    return [exiftool, "-overwrite_original", "-TagsFromFile", source, "-XMP:All", "-IPTC:All",
        "-XMP-GContainer:All=", "-XMP-hdrgm:All=", "-XMP-HDRGainMap:All=", "-XMP-hdr:All=", "-XMP-apdi:All=", "-XMP-tiff:Orientation=", target];
}
module.exports = { buildMetadataCopyArgv };
