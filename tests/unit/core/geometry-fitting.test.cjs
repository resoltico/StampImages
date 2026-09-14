"use strict";

/*
 * A stamp that cannot fit is refused rather than cropped.
 *
 * Measured: vips crops an overlay to the image beneath it, so a caption too
 * long for a small photograph was published as its first two letters and
 * reported as a success.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { placeStamp } = require("../../../src/core/geometry.js");

const IMAGE = { width: 1000, height: 800 };

test("a stamp larger than the photograph is refused, not cropped", () => {
    // Measured: vips crops an overlay to the image beneath it, so a caption
    // too long for a small photograph was published as its first two letters
    // and reported as a success.
    assert.throws(
        () => placeStamp(IMAGE, { width: 1200, height: 900 }, {
            position: "bottom-right",
            margin: 20
        }),
        (error) => {
            assert.match(error.message, /does not fit on this photograph/u);
            assert.match(error.message, /1200 by 900 pixels/u);
            assert.match(error.message, /1000 by 800 pixels/u);
            assert.match(error.message, /smaller text size/u);

            return true;
        }
    );
});

test("one dimension too large is too large", () => {
    for (const stamp of [{ width: 1001, height: 10 }, { width: 10, height: 801 }]) {
        assert.throws(
            () => placeStamp(IMAGE, stamp, { position: "top-left", margin: 0 }),
            /does not fit/u,
            JSON.stringify(stamp)
        );
    }
});

test("a stamp that fits exactly fits", () => {
    assert.deepEqual(
        placeStamp(IMAGE, { width: 1000, height: 800 }, {
            position: "bottom-right",
            margin: 20
        }),
        { left: 0, top: 0, crowded: true }
    );
});
