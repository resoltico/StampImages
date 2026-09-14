"use strict";

/*
 * What a walk leaves behind, and whether it says so.
 *
 * Two different silences. Nobody asked about the other files in a folder, so
 * passing over a text file is right and saying so would bury the run in
 * rejections. A copy this program made is a photograph by every test the walk
 * applies, so leaving it out without a word would be the run quietly doing
 * less than it was asked.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { imagesInFolder } = require("../../../src/runtime/expand.js");
const { treeOf } = require("./fake-tree.cjs");

test("a copy this program made is not a photograph to stamp again", () => {
    // Somebody who selects a folder has asked for the photographs in it, and
    // the copies a previous run left there are not photographs they took.
    const tree = treeOf({
        "/a": ["holiday.jpg", "holiday_stamped.jpg", "holiday_stamped_2.jpg"]
    });
    const found = imagesInFolder(tree, "/a", new Set());

    assert.deepEqual(found.found, ["/a/holiday.jpg"]);
    assert.deepEqual(
        found.problems.map((problem) => problem.path),
        ["/a/holiday_stamped.jpg", "/a/holiday_stamped_2.jpg"]
    );
    assert.match(found.problems[0].reason, /already a stamped copy/u);
});

test("what is not an image at all is passed over without a word", () => {
    // Nobody asked about the other files in a folder, and a folder of
    // documents would otherwise report a rejection for every one of them.
    const tree = treeOf({ "/a": ["holiday.jpg", "notes.txt", "sub"], "/a/sub": [] });
    const found = imagesInFolder(tree, "/a", new Set());

    assert.deepEqual(found.found, ["/a/holiday.jpg"]);
    assert.deepEqual(found.problems, []);
});

test("a folder inside a folder is walked, not reported", () => {
    // Only a file can be a photograph, so a subfolder is neither taken nor
    // named: it is walked in its turn.
    const tree = treeOf({ "/a": ["sub", "holiday.jpg"], "/a/sub": ["inside.png"] });
    const found = imagesInFolder(tree, "/a", new Set());

    assert.deepEqual(found.found, ["/a/sub/inside.png", "/a/holiday.jpg"]);
    assert.deepEqual(found.problems, []);
});

test("an entry that cannot be looked at is named, and is not an exclusion", () => {
    // It might have been a photograph, so it is part of what was asked for --
    // unlike a copy this program made, which was not.
    const tree = treeOf({ "/a": ["b.png"] }, { "/a/b.png": "missing" });
    const found = imagesInFolder(tree, "/a", new Set());

    assert.deepEqual(found.problems, [
        { path: "/a/b.png", reason: "could not be examined", excluded: false }
    ]);
});
