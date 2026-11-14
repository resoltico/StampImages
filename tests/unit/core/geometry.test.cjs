"use strict";

/*
 * Where the block of text goes on the photograph.
 *
 * In pixels of the image itself, measured from the edge the position names.
 * The result is always inside the picture: half a caption is unreadable, and
 * a negative offset is an error from the compositor rather than a photograph.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    placeStamp,
    edgesOf
} = require("../../../src/core/geometry.js");

const IMAGE = { width: 1000, height: 800 };
const STAMP = { width: 200, height: 100 };

function place(position, margin = 20) {
    const { left, top } = placeStamp(IMAGE, STAMP, { position, margin });

    return { left, top };
}

test("a position names two edges, and is read as two decisions", () => {
    assert.deepEqual(edgesOf("bottom-right"), {
        vertical: "bottom",
        horizontal: "right"
    });
    assert.deepEqual(edgesOf("top-center"), {
        vertical: "top",
        horizontal: "center"
    });
});

test("each corner is the margin in from its own two edges", () => {
    assert.deepEqual(place("top-left"), { left: 20, top: 20 });
    assert.deepEqual(place("top-right"), { left: 780, top: 20 });
    assert.deepEqual(place("bottom-left"), { left: 20, top: 680 });
    assert.deepEqual(place("bottom-right"), { left: 780, top: 680 });
});

test("centered is centered across, and still margined down", () => {
    // The margin is about the edge the position names, and center names none.
    assert.deepEqual(place("bottom-center"), { left: 400, top: 680 });
    assert.deepEqual(place("top-center"), { left: 400, top: 20 });
});



test("an excessive margin stops at the center and is reported", () => {
    // The whole stamp is still visible, and a margin is a request rather than
    // a promise -- but a run that quietly did something else should say so.
    assert.deepEqual(place("bottom-right", 5000), { left: 400, top: 350 });
    assert.equal(
        placeStamp(IMAGE, STAMP, { position: "bottom-right", margin: 20 }).crowded,
        false
    );
    assert.equal(
        placeStamp(IMAGE, STAMP, { position: "bottom-right", margin: 5000 }).crowded,
        true
    );
});

test("a margin that would cross the center is reduced at each active edge", () => {
    const placed = placeStamp(
        { width: 100, height: 100 },
        { width: 80, height: 80 },
        { position: "bottom-right", margin: 15 }
    );

    assert.deepEqual(placed, { left: 10, top: 10, crowded: true });
});

test("an excessive top-left margin stays in the top-left half", () => {
    assert.deepEqual(place("top-left", 5000), { left: 400, top: 350 });
});

test("an odd number of pixels to share is a whole pixel", () => {
    // Compositing takes integers; half a pixel is not an offset.
    const placed = placeStamp({ width: 1001, height: 800 }, STAMP, {
        position: "bottom-center",
        margin: 20
    });

    assert.equal(placed.left, 401);
    assert.equal(Number.isInteger(placed.top), true);
});

test("the margin is honored when there is room for it at the named edges", () => {
    const stamp = { width: 800, height: 600 };
    const crowdedAt = (margin) =>
        placeStamp(IMAGE, stamp, { position: "bottom-right", margin }).crowded;

    assert.equal(crowdedAt(100), false, "exactly half the remaining room");
    assert.equal(crowdedAt(101), true, "one pixel past the center boundary");
});

test("the tighter of the two directions decides", () => {
    const crowdedAt = (margin) => placeStamp(
        IMAGE,
        { width: 100, height: 790 },
        { position: "bottom-right", margin }
    ).crowded;

    assert.equal(crowdedAt(6), true, "wide enough across, nothing to spare down");
    assert.equal(crowdedAt(5), false);
});

test("crowding is either direction, on its own", () => {
    const crowded = (position, margin, stamp) =>
        placeStamp(IMAGE, stamp, { position, margin }).crowded;

    assert.equal(crowded("bottom-right", 300, { width: 100, height: 790 }), true);
    assert.equal(crowded("bottom-right", 300, { width: 790, height: 100 }), true);
    assert.equal(crowded("bottom-right", 5, { width: 790, height: 790 }), false);
});


test("odd remaining room keeps every selected half with whole-pixel offsets", () => {
    const image = { width: 1001, height: 801 };
    for (const [position, expected] of [
        ["top-left", { left: 400, top: 350 }], ["top-right", { left: 401, top: 350 }],
        ["bottom-left", { left: 400, top: 351 }], ["bottom-right", { left: 401, top: 351 }],
        ["top-center", { left: 401, top: 350 }], ["bottom-center", { left: 401, top: 351 }]
    ]) {
        assert.deepEqual(placeStamp(image, STAMP, { position, margin: 2000 }), { ...expected, crowded: true });
    }
});

test("a centered axis never reports crowding from unused horizontal margin", () => {
    assert.deepEqual(placeStamp({ width: 201, height: 1000 }, STAMP, { position: "bottom-center", margin: 30 }),
        { left: 1, top: 870, crowded: false });
});
