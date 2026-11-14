"use strict";
const { MOMENT_TAGS } = require("../core/metadata.js");

// Input is an already decoded/validated PRIVATE producer projection. Output
// contains domain capture facts, never FileName, SourceFile or tool version.
function captureFacts(projection) {
    const owns = (key) => Object.hasOwn(projection, key);
    const facts = {};

    for (const tag of MOMENT_TAGS) {
        if (owns(tag)) {
            facts[tag] = projection[tag];
        }
    }

    const exif = {};
    const xmp = {};

    for (const [axis, tag] of [["latitude", "Latitude"], ["longitude", "Longitude"]]) {
        const rational = `EXIFGPS${tag}`;
        const raw = `EXIFGPS${tag}Raw`;
        const ref = `EXIFGPS${tag}Ref`;
        const lexical = `XMPGPS${tag}`;

        if (owns(rational) || owns(raw)) {
            // A recorded coordinate with no original rational representation
            // stays explicitly invalid; it must not disappear as "missing".
            exif[axis] = typeof projection[rational] === "string"
                ? projection[rational].trim().split(/\s+/u).map((part) => part.split("/"))
                : null;
        }

        if (owns(ref)) {
            exif[`${axis}Ref`] = projection[ref];
        }

        if (owns(lexical)) {
            xmp[axis] = projection[lexical];
        }
    }

    if (Object.keys(exif).length || Object.keys(xmp).length) {
        facts.gps = { exif, xmp };
    }

    return facts;
}

module.exports = { captureFacts };
