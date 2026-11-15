"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    STAMPED,
    looksStamped,
    describeExcluded,
    nameFrom,
    splitExtension,
    collisionPath,
    stagedPath
} = require("../../../src/core/naming.js");

test("a name preserves the legal source stem and appends the supplied suffix", () => {
    // The extension comes from the caller because what is written is not
    // always what was read: a HEIC photograph can be saved as a JPEG.
    assert.equal(nameFrom("IMG_1234.HEIC", "_stamped.jpg"), "IMG_1234_stamped.jpg");
    assert.equal(nameFrom("A:B.png", "_stamped.png"), "A:B_stamped.png");
    assert.equal(nameFrom("holiday.jpeg", "_T.jpeg"), "holiday_T.jpeg");
});





test("stagedPath stays inside the workspace and sanitizes its token", () => {
    // Never beside the images: a file a tool writes into the output folder
    // turned out to be one the Shortcuts helper could not touch afterwards.
    assert.equal(
        stagedPath("/tmp/StampImages.X", "abc:123", ".jpg"),
        "/tmp/StampImages.X/staged-abc_123.jpg"
    );
    assert.match(stagedPath("/tmp/ws", "x", ".jpg"), /^\/tmp\/ws\//u);
});

test("a staged name cannot escape the workspace", () => {
    // The token becomes part of a filename, so a separator in it would place
    // the file somewhere else entirely.
    for (const token of ["../escape", "a/b", "/absolute"]) {
        const staged = stagedPath("/tmp/ws", token, ".jpg");

        assert.equal(
            staged.slice("/tmp/ws/".length).includes("/"),
            false,
            `${token} produced ${staged}`
        );
    }
});

test("the extension is the last one, not the first one found", () => {
    // A name can hold more than one dot. Numbering has to go before the
    // extension that is actually on the end, or ".bak" would be treated as
    // part of the stem and the number would land in the middle of the name.
    assert.deepEqual(splitExtension("/tmp/a.jpg.bak"), {
        stem: "/tmp/a.jpg",
        extension: ".bak"
    });
    assert.equal(
        collisionPath("/tmp/a.jpg.bak", 2),
        "/tmp/a.jpg 2.bak"
    );
});


test("a stamped copy is recognized by its mark, and by nothing else", () => {
    for (const name of [
        "holiday_stamped.jpg",
        "holiday_stamped 2.png",
        "holiday_stamped 10.jpeg",
        "_stamped.jpg"
    ]) {
        assert.equal(looksStamped(name), true, name);
    }

    for (const name of [
        "holiday.jpg",
        "stamped.jpg",
        "holiday_stamped_x.jpg",
        "holiday_stamped2.jpg",
        "my_stamped_photos.jpg",
        "holiday_stampede.jpg"
    ]) {
        assert.equal(looksStamped(name), false, name);
    }
});

test("the mark a copy carries is the mark a copy is given", () => {
    assert.equal(looksStamped(nameFrom("holiday.jpg", `${STAMPED}.jpg`)), true);
});

test("what a walk left alone is said once, for the run", () => {
    // A folder stamped a second time holds as many of these as it does
    // photographs, and a report that listed them all would bury everything
    // else underneath.
    assert.match(describeExcluded([{}, {}]), /^Left alone: 2 stamped copies/u);
    assert.match(describeExcluded([{}]), /^Left alone: 1 stamped copy/u);
});


test("leading dots, underscores and spaces stay exact while controls cannot create output lines", () => {
    for (const stem of [".explicit", "__name__", " spaced ", "trailing.", "A:B", "a\\b", "مرحبا", "rīga"]) {
        assert.equal(nameFrom(`${stem}.jpg`, "_stamped.jpg"), `${stem}_stamped.jpg`);
    }
    assert.equal(nameFrom("line\nbreak.JPG", "_stamped.JPG"), "line_break_stamped.JPG");
    assert.equal(nameFrom("a\r\tb.png", "_stamped.png"), "a__b_stamped.png");
    assert.equal(nameFrom("a\u2028b.png", "_stamped.png"), "a_b_stamped.png");
    assert.equal(nameFrom("", "_stamped.png"), "image_stamped.png");
});
