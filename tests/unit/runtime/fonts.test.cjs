"use strict";

/*
 * Which faces the form suggests.
 *
 * A handful, from a list of families macOS ships, kept only where this Mac
 * really has them -- and each with its bold face beside it where the family
 * really has one. Everything else on the machine is a name away, which is why
 * the list can be short.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { availableFonts, CANDIDATES } = require("../../../src/runtime/fonts.js");
const { catalogueOf } = require("./fake-typefaces.cjs");

function withEvery(faces) {
    return catalogueOf(
        Object.fromEntries(CANDIDATES.map((family) => [family, faces]))
    );
}

test("every family is offered as itself and in bold", () => {
    // Bold is the variation nearly everybody wants and the one worth saving
    // somebody from typing. 1.0.0 offered it too, and never checked it: only
    // the plain name was ever drawn with, so the bold half of the list was ten
    // names nothing had confirmed. It is confirmed here, against the family's
    // own faces.
    const offered = availableFonts(withEvery(["Regular", "Italic", "Bold"]));

    assert.deepEqual(offered.slice(0, 4), [
        "Helvetica Neue",
        "Helvetica Neue Bold",
        "Arial",
        "Arial Bold"
    ]);
    assert.equal(offered.length, CANDIDATES.length * 2);
});

test("a family with no bold face is offered alone", () => {
    const offered = availableFonts(withEvery(["Regular", "Heavy"]));

    assert.deepEqual(offered, CANDIDATES);
});

test("a family this Mac has not is not offered", () => {
    const offered = availableFonts(
        catalogueOf({ Menlo: ["Regular"], Georgia: ["Regular", "Bold"] })
    );

    assert.deepEqual(offered, ["Georgia", "Georgia Bold", "Menlo"]);
});

test("a machine with none of them is not a machine that cannot be used", () => {
    // The field takes any name, so a Mac with none of these ten and hundreds
    // of others must not be stopped at the door.
    assert.deepEqual(availableFonts(catalogueOf({})), []);
});

test("a host with no catalogue is offered the candidates unfiltered", () => {
    // Nothing can be checked without one, and offering nothing at all on a
    // machine that has them would be the worse failure. A catalogue is not
    // something a person can go and install.
    assert.deepEqual(availableFonts(null), CANDIDATES);
});

test("the names offered are the ones that resolve", () => {
    // A suggestion that would be refused the moment it was chosen is worse
    // than no suggestion, so the list and the resolver read the same answer.
    const { faceOf } = require("../../../src/core/typeface.js");
    const known = withEvery(["Regular", "Bold"]);

    for (const offered of availableFonts(known)) {
        assert.ok(faceOf(known, offered), offered);
    }
});
