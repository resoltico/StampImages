"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    STAMPED,
    looksStamped,
    describeExcluded,
    nameFrom,
    splitExtension,
    nextUniquePath,
    stagedPath
} = require("../../../src/core/naming.js");

test("a name is the source stem, sanitized, with what the caller adds", () => {
    // The extension comes from the caller because what is written is not
    // always what was read: a HEIC photograph can be saved as a JPEG.
    assert.equal(nameFrom("IMG_1234.HEIC", "_stamped.jpg"), "IMG_1234_stamped.jpg");
    assert.equal(nameFrom("A:B.png", "_stamped.png"), "A_B_stamped.png");
    assert.equal(nameFrom("holiday.jpeg", "_T.jpeg"), "holiday_T.jpeg");
});

test("nextUniquePath returns the path when it is free", () => {
    assert.equal(nextUniquePath("/tmp/b.jpg", () => false), "/tmp/b.jpg");
});

test("nextUniquePath starts suffixing at 2", () => {
    // With only the original occupied, the first candidate must be _2. A
    // sequence starting at 3 would still satisfy the two-occupied case below,
    // so this is the assertion that pins the starting point.
    const occupied = new Set(["/tmp/a.jpg"]);

    assert.equal(
        nextUniquePath("/tmp/a.jpg", (candidate) => occupied.has(candidate)),
        "/tmp/a_2.jpg"
    );
});

test("nextUniquePath suffixes past every occupied candidate", () => {
    const occupied = new Set(["/tmp/a.jpg", "/tmp/a_2.jpg"]);

    assert.equal(
        nextUniquePath("/tmp/a.jpg", (candidate) => occupied.has(candidate)),
        "/tmp/a_3.jpg"
    );
});

test("nextUniquePath gives up rather than searching forever", () => {
    assert.throws(() => nextUniquePath("/tmp/a.jpg", () => true), /Could not create/u);
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
        nextUniquePath("/tmp/a.jpg.bak", (path) => path === "/tmp/a.jpg.bak"),
        "/tmp/a.jpg_2.bak"
    );
});

test("the unique-path search is bounded", () => {
    let probed = 0;

    assert.throws(() => nextUniquePath("/tmp/a.jpg", () => {
        probed += 1;

        return true;
    }), /Could not create/u);
    // Bounded, and the bound is not off by one: 2..9999 inclusive plus the
    // original path.
    assert.equal(probed, 9999);
});

test("a stamped copy is recognised by its mark, and by nothing else", () => {
    for (const name of [
        "holiday_stamped.jpg",
        "holiday_stamped_2.png",
        "holiday_stamped_10.jpeg",
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
