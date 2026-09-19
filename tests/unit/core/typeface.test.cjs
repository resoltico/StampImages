"use strict";

/*
 * A typeface, named the way a person names one, resolved against what this
 * Mac has.
 *
 * One field holds the whole name -- family, then style when a particular face
 * is wanted -- because a weight menu can only offer the weights somebody
 * thought of. Avenir has Book, Light, Medium, Heavy and Black, and a Regular
 * or Bold menu reaches none of them.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { faceOf } = require("../../../src/core/typeface.js");
const {
    resolved,
    inWords
} = require("../../../src/core/typeface-refusal.js");
const { catalogueOf } = require("./fake-typefaces.cjs");

const KNOWN = catalogueOf({
    Avenir: ["Book", "Light", "Black", "Black Oblique"],
    "Avenir Next": ["Regular", "Bold"],
    "Arial Hebrew": ["Regular"],
    "Arial Hebrew Scholar": ["Regular"],
    "Source Serif 4": ["Regular", "Semibold", "Black Italic"]
});

test("a family on its own is the family and its own default face", () => {
    assert.deepEqual(faceOf(KNOWN, "Avenir"), { family: "Avenir", face: "" });
});

test("a style after the family names that face", () => {
    assert.deepEqual(
        faceOf(KNOWN, "Avenir Black Oblique"),
        { family: "Avenir", face: "Black Oblique" }
    );
});

test("the named instances of a variable font are faces like any other", () => {
    // Which is what makes them reachable without this program knowing
    // anything about font files: the font system lists them as styles.
    assert.deepEqual(
        faceOf(KNOWN, "Source Serif 4 Semibold"),
        { family: "Source Serif 4", face: "Semibold" }
    );
});

test("whatever was capitalised, and however it was spaced", () => {
    assert.deepEqual(
        faceOf(KNOWN, "  avenir   BLACK "),
        { family: "Avenir", face: "Black" }
    );
});

test("the longest family wins, because families contain style words", () => {
    // "Avenir Next" is a family and not Avenir in a style called Next, and
    // "Arial Hebrew Scholar" is a family and not Arial Hebrew in some Scholar
    // style. Taking the shortest match would name the wrong family for both
    // and then refuse a typeface this Mac has.
    assert.deepEqual(
        faceOf(KNOWN, "Avenir Next"),
        { family: "Avenir Next", face: "" }
    );
    assert.deepEqual(
        faceOf(KNOWN, "Arial Hebrew Scholar"),
        { family: "Arial Hebrew Scholar", face: "" }
    );
});

test("a name nothing matches is no face at all", () => {
    assert.equal(faceOf(KNOWN, "Comic Sans MS"), null);
    assert.equal(faceOf(KNOWN, "Avenir Ultrablack"), null);
    assert.equal(faceOf(KNOWN, "   "), null);
});

test("a name nothing recognises is told how to name one", () => {
    const said = resolved(KNOWN, "Comic Sans MS").problem;

    assert.match(said, /This Mac has no typeface called "Comic Sans MS"/u);
    assert.match(said, /Name it as Font Book does -- the family/u);
    assert.match(
        said,
        /"Helvetica Neue Bold" and "Avenir Black" are all names this takes/u,
        "and shows both shapes, because the second is the one nobody guesses"
    );
});

test("a family with the wrong style is told what the family comes in", () => {
    // A sentence only a real catalogue can write, and the reason for reading
    // one: the refusal this replaces could say the name failed and no more.
    const said = resolved(KNOWN, "Avenir Ultrablack").problem;

    assert.match(said, /^Avenir has no style called "Ultrablack"\./u);
    assert.match(said, /Book, Light, Black and Black Oblique/u);
});

test("the family is the longest prefix that is one, and the rest is the style", () => {
    // "Avenir Ultra" is not a family, so the family is "Avenir" and the style
    // asked for is both remaining words. Reading the first failure as the
    // answer would report a name nothing recognises, about a family this Mac
    // has; keeping only the last word would quote a style nobody typed.
    assert.equal(
        resolved(KNOWN, "Avenir Ultra Heavy").problem,
        'Avenir has no style called "Ultra Heavy".\n\n' +
            "It comes in Book, Light, Black and Black Oblique."
    );
});

test("a name that resolves is no problem, and carries both halves", () => {
    assert.deepEqual(
        resolved(KNOWN, "Avenir Light"),
        { typeface: { family: "Avenir", face: "Light" } }
    );
});

test("a host with no catalogue passes the name on whole", () => {
    // Nothing can be checked, so nothing is: the description is written
    // without the comma and pango splits it, which is worse and is all there
    // is. Refusing every typeface on a machine that has them all is worse
    // still, and a catalogue is not something a person can install.
    assert.deepEqual(
        resolved(null, "Helvetica Neue Bold"),
        { typeface: { name: "Helvetica Neue Bold" } }
    );
});

test("a list of faces reads as a person would say it", () => {
    assert.equal(inWords([]), "");
    assert.equal(inWords(["Regular"]), "Regular");
    assert.equal(inWords(["Regular", "Bold"]), "Regular and Bold");
    assert.equal(
        inWords(["Regular", "Italic", "Bold"]),
        "Regular, Italic and Bold"
    );
});
