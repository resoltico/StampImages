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
    edgesOf,
    describeCrowding
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
    assert.deepEqual(edgesOf("top-centre"), {
        vertical: "top",
        horizontal: "centre"
    });
});

test("each corner is the margin in from its own two edges", () => {
    assert.deepEqual(place("top-left"), { left: 20, top: 20 });
    assert.deepEqual(place("top-right"), { left: 780, top: 20 });
    assert.deepEqual(place("bottom-left"), { left: 20, top: 680 });
    assert.deepEqual(place("bottom-right"), { left: 780, top: 680 });
});

test("centred is centred across, and still margined down", () => {
    // The margin is about the edge the position names, and centre names none.
    assert.deepEqual(place("bottom-centre"), { left: 400, top: 680 });
    assert.deepEqual(place("top-centre"), { left: 400, top: 20 });
});



test("a margin with no room for it is the edge, and it is said", () => {
    // The whole stamp is still visible, and a margin is a request rather than
    // a promise -- but a run that quietly did something else should say so.
    assert.deepEqual(place("bottom-right", 5000), { left: 0, top: 0 });
    assert.equal(
        placeStamp(IMAGE, STAMP, { position: "bottom-right", margin: 20 }).crowded,
        false
    );
    assert.equal(
        placeStamp(IMAGE, STAMP, { position: "bottom-right", margin: 5000 }).crowded,
        true
    );
    assert.match(describeCrowding(3), /^3 photographs had too little room/u);
    assert.match(describeCrowding(1), /^1 photograph had/u);
});

test("a margin measured from two edges is not measured from four", () => {
    // An eighty-pixel stamp fifteen pixels in from the corner of a
    // hundred-pixel photograph has its margin: the other two edges get
    // whatever is left, and asking for room on all four reported it as
    // sitting against the edge.
    const placed = placeStamp(
        { width: 100, height: 100 },
        { width: 80, height: 80 },
        { position: "bottom-right", margin: 15 }
    );

    assert.deepEqual(placed, { left: 5, top: 5, crowded: false });
});

test("a margin larger than the room there is stops at the edge", () => {
    assert.deepEqual(place("top-left", 5000), { left: 800, top: 700 });
});

test("an odd number of pixels to share is a whole pixel", () => {
    // Compositing takes integers; half a pixel is not an offset.
    const placed = placeStamp({ width: 1001, height: 800 }, STAMP, {
        position: "bottom-centre",
        margin: 20
    });

    assert.equal(placed.left, 401);
    assert.equal(Number.isInteger(placed.top), true);
});

test("the margin is honoured when there is room for it at the named edges", () => {
    const stamp = { width: 800, height: 600 };
    const crowdedAt = (margin) =>
        placeStamp(IMAGE, stamp, { position: "bottom-right", margin }).crowded;

    assert.equal(crowdedAt(200), false, "exactly the room there is");
    assert.equal(crowdedAt(201), true, "one pixel more than there is");
});

test("the tighter of the two directions decides", () => {
    const crowdedAt = (margin) => placeStamp(
        IMAGE,
        { width: 100, height: 790 },
        { position: "bottom-right", margin }
    ).crowded;

    assert.equal(crowdedAt(11), true, "wide enough across, nothing to spare down");
    assert.equal(crowdedAt(10), false);
});

test("crowding is either direction, on its own", () => {
    const crowded = (position, margin, stamp) =>
        placeStamp(IMAGE, stamp, { position, margin }).crowded;

    assert.equal(crowded("bottom-right", 300, { width: 100, height: 790 }), true);
    assert.equal(crowded("bottom-right", 300, { width: 790, height: 100 }), true);
    assert.equal(crowded("bottom-right", 5, { width: 790, height: 790 }), false);
});
