"use strict";

/*
 * What this program will and will not copy.
 *
 * A stamped copy is a copy: the same picture, in the same colours, with one
 * block of text on it. A file this cannot say that about is refused with the
 * reason, which is a better outcome than a copy that is quietly something
 * else.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    refuseUnfaithful,
    hasAlpha,
    kindOf,
    pagesIn
} = require("../../../src/runtime/fidelity.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    return makeJob(createFakeHost({ files: ["/a/one.jpg"], ...settings }));
}

function checking(settings) {
    const job = jobOn(settings);

    return () => refuseUnfaithful(job, "/a/one.jpg", "/w/oriented-1.v");
}

test("a colour photograph and a grey one are both copied faithfully", () => {
    for (const stored of ["colour", "grey", "deep"]) {
        assert.doesNotThrow(checking({ stored }), stored);
    }
});

test("a photograph stored as ink is refused, and the reason names it", () => {
    // The four bands of a CMYK photograph are not three colours and an alpha,
    // and compositing onto them would produce a copy in different colours.
    assert.throws(checking({ stored: "print" }), (error) => {
        assert.match(error.message, /not stored as colour or grey/u);
        assert.match(error.message, /CMYK/u);

        return true;
    });
});

test("a file holding more than one image is refused, and says how many", () => {
    // vips loads the first page of a multipage file, so a copy of it would
    // hold only that one and nothing would say so.
    assert.throws(checking({ pages: 7 }), /holds 7 images/u);
});

test("a file with no page count at all is one image", () => {
    // vipsheader has no answer for a single-page file -- the field is absent
    // and the command fails -- so the failure is the answer.
    assert.equal(pagesIn(jobOn(), "/a/one.jpg"), 1);
    assert.equal(pagesIn(jobOn({ pages: 1 }), "/a/one.jpg"), 1);
    assert.equal(pagesIn(jobOn({ pages: 4 }), "/a/one.jpg"), 4);
});

test("what a file says it is is read out of the enum vips prints", () => {
    assert.equal(kindOf(jobOn(), "/a/one.jpg"), "sRGB");
    assert.equal(kindOf(jobOn({ stored: "grey" }), "/a/one.jpg"), "B_W");
});

test("an answer that is not an interpretation at all is not one", () => {
    assert.equal(kindOf(jobOn({ stored: "" }), "/a/one.jpg"), "");
    assert.throws(checking({ stored: "" }), /not stored as colour or grey/u);
});

test("an even band count is the alpha, once ink is out of the question", () => {
    // Measured, because the band count alone cannot tell them apart: a CMYK
    // JPEG and a PNG with transparency both report four.
    for (const [bands, alpha] of [[1, false], [2, true], [3, false], [4, true]]) {
        assert.equal(hasAlpha(jobOn({ bands }), "/a/one.jpg"), alpha, `${bands}`);
    }
});

test("one image is one image, and none is one too", () => {
    // Written as "more than one", so an off-by-one here refuses every
    // photograph on the machine.
    assert.doesNotThrow(checking({ pages: 1 }));
    assert.throws(checking({ pages: 2 }), /holds 2 images/u);
});

test("the reason a file is refused says which file it is about", () => {
    assert.throws(checking({ pages: 3 }), /a stamped copy of it would hold only the first/u);
    assert.throws(
        checking({ stored: "print" }),
        /would not be the colours it is/u
    );
});
