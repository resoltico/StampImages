"use strict";

/*
 * The one answer the form cannot read for itself.
 *
 * Every other setting is decided by what it says -- a number is in range or it
 * is not -- and a typeface is decided by the renderer, by drawing with it. The
 * list the form offers is what this Mac drew with, so anything on it is
 * settled; a name typed instead is asked about, and a name that draws nothing
 * comes back the way a number out of range does.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { collectViaForm } = require("../../../src/runtime/settings-form.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { askingContext } = require("./fake-assembly.cjs");

const BRIDGE = { objc: {}, ns: {} };
const FONTS = ["Menlo", "Menlo Bold"];

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

function asking(drawable) {
    const context = askingContext(FONTS);
    const asked = [];

    return {
        asked,
        opening: {
            answers: defaultAnswers(FONTS),
            context: {
                ...context,
                draws(family) {
                    asked.push(family);

                    return drawable.includes(family);
                }
            }
        }
    };
}

test("a face that is not on the list is taken, once the renderer draws it", () => {
    // The whole point: probing every family fontconfig knows would cost a
    // rendering apiece, so the list is a handful worth having at hand and the
    // field takes the name of anything else this Mac has.
    const { asked, opening } = asking(["Menlo", "Menlo Bold", "Zapfino"]);
    const present = scripted([{ answers: typing("Zapfino") }]);
    const settings = collectViaForm(BRIDGE, present, opening);

    assert.equal(settings.font, "Zapfino");
    assert.deepEqual(asked, ["Zapfino"], "and it was asked about, being typed");
    assert.equal(present.seen.length, 1, "so the form was shown once");
});

test("a face that draws nothing is marked, with everything else still typed", () => {
    // Not a run that ends: it is the same kind of problem a number out of
    // range is, and it comes back the same way -- the field marked, the
    // sentence at the top, and the other nine answers where they were.
    const { opening } = asking(FONTS);
    const present = scripted([
        { answers: typing("Comic Sans MS") },
        { answers: typing("Menlo") }
    ]);
    const settings = collectViaForm(BRIDGE, present, opening);

    assert.equal(settings.font, "Menlo");

    const [, second] = present.seen;

    assert.match(second.detail, /This Mac does not draw with the typeface "Comic Sans MS"/u);
    assert.equal(second.rows.find((row) => row.key === "font").invalid, true);
    assert.equal(
        second.rows.find((row) => row.key === "customText").value,
        "Riga",
        "and the rest of the answers are still there"
    );
});

test("a face taken from the list is not asked about at all", () => {
    // It was drawn with to find it. Asking again would be a rendering spent
    // on an answer this run already has.
    const { asked, opening } = asking(FONTS);

    collectViaForm(BRIDGE, scripted([{ answers: typing("Menlo Bold") }]), opening);

    assert.deepEqual(asked, ["Menlo Bold"], "asked of the probe, which knows it");
});

test("a typeface left empty is refused before the renderer is troubled", () => {
    const { asked, opening } = asking(FONTS);
    const present = scripted([
        { answers: typing("   ") },
        { answers: typing("Menlo") }
    ]);

    collectViaForm(BRIDGE, present, opening);

    const [, second] = present.seen;

    assert.match(second.detail, /name a face to draw with/u);
    assert.deepEqual(asked, ["Menlo"], "nothing was drawn for an empty name");
});
