"use strict";

/*
 * The one answer the form cannot read for itself.
 *
 * Every other setting is decided by what it says -- a number is in range or it
 * is not -- and a typeface is decided by what this Mac has. The list the form
 * offers comes from the same catalogue, so anything on it resolves; a name
 * typed instead is resolved the same way, and one that names nothing comes
 * back as a number out of range does.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { collectViaForm } = require("../../../src/runtime/settings-form.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { askingContext } = require("./fake-assembly.cjs");
const { catalogueOf } = require("./fake-typefaces.cjs");

const BRIDGE = { objc: {}, ns: {} };
const FONTS = ["Menlo", "Menlo Bold"];
const KNOWN = catalogueOf({
    Menlo: ["Regular", "Italic", "Bold"],
    Zapfino: ["Regular"]
});

function scripted(outcomes) {
    const seen = [];
    const present = (bridge, spec) => {
        seen.push(spec);

        return outcomes.shift();
    };

    present.seen = seen;

    return present;
}

function typing(font) {
    return { ...defaultAnswers(FONTS), font, customText: "Riga" };
}

function opening(known = KNOWN) {
    return {
        answers: defaultAnswers(FONTS),
        context: askingContext(FONTS, 1, known)
    };
}

test("a face that is not on the list is taken, once this Mac has it", () => {
    // The whole point: a menu of 217 families is not a menu, so the list is a
    // handful worth having at hand and the field takes the name of anything
    // else the machine has.
    const present = scripted([{ answers: typing("Zapfino") }]);
    const { settings } = collectViaForm(BRIDGE, present, opening());

    assert.equal(settings.font, "Zapfino");
    assert.equal(present.seen.length, 1, "so the form was shown once");
});

test("a style of a family is a name the field takes", () => {
    // Which a weight menu could not reach: Menlo has four faces and a menu of
    // Regular and Bold can name two of them.
    const present = scripted([{ answers: typing("Menlo Italic") }]);

    assert.equal(collectViaForm(BRIDGE, present, opening()).settings.font, "Menlo Italic");
});

test("a face this Mac has not is marked, with everything else still typed", () => {
    // Not a run that ends: it is the same kind of problem a number out of
    // range is, and it comes back the same way -- the field marked, the
    // sentence at the top, and the other answers where they were.
    const present = scripted([
        { answers: typing("Comic Sans MS") },
        { answers: typing("Menlo") }
    ]);
    const { settings } = collectViaForm(BRIDGE, present, opening());

    assert.equal(settings.font, "Menlo");

    const [, second] = present.seen;

    assert.match(second.detail, /This Mac has no typeface called "Comic Sans MS"/u);
    assert.equal(second.rows.find((row) => row.key === "font").invalid, true);
    assert.equal(
        second.rows.find((row) => row.key === "customText").value,
        "Riga",
        "and the rest of the answers are still there"
    );
});

test("a family with the wrong style is told what the family comes in", () => {
    const present = scripted([
        { answers: typing("Menlo Black") },
        { answers: typing("Menlo") }
    ]);

    collectViaForm(BRIDGE, present, opening());

    assert.match(
        present.seen[1].detail,
        /Menlo has no style called "Black"[\s\S]*Regular, Italic and Bold/u
    );
});

test("a typeface left empty is refused before the catalogue is consulted", () => {
    const present = scripted([
        { answers: typing("   ") },
        { answers: typing("Menlo") }
    ]);

    collectViaForm(BRIDGE, present, opening());
    assert.match(present.seen[1].detail, /name a face to draw with/u);
});

test("a host with no catalogue takes the name it is given", () => {
    // Nothing can be checked, and refusing every typeface on a machine that
    // has them all would be the worse failure.
    const present = scripted([{ answers: typing("Whatever It Is") }]);

    assert.equal(
        collectViaForm(BRIDGE, present, opening(null)).settings.font,
        "Whatever It Is"
    );
});
