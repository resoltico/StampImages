"use strict";
// Shape-only domain fixtures. No conversion/parser logic is shared with production.
function exifFacts(latitude, longitude, latitudeRef = "N", longitudeRef = "E") {
    return { gps: { exif: { latitude, longitude, latitudeRef, longitudeRef } } };
}
function wholeDegrees(latitude, longitude, latitudeRef = "N", longitudeRef = "E") {
    return exifFacts([[String(latitude), "1"], ["0", "1"], ["0", "1"]],
        [[String(longitude), "1"], ["0", "1"], ["0", "1"]], latitudeRef, longitudeRef);
}
function rigaFacts() {
    return exifFacts([["56", "1"], ["56", "1"], ["1464", "25"]], [["24", "1"], ["6", "1"], ["468", "25"]]);
}
module.exports = { exifFacts, wholeDegrees, rigaFacts };
