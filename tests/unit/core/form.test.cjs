"use strict";

/*
 * What the form says around its questions: the title above it, the buttons
 * under it, and the line between the two -- which is either an invitation or
 * the list of what needs correcting.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    formSpec,
    invitation,
    CREATE_BUTTON,
    CANCEL_BUTTON
} = require("../../../src/core/form.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");

const FONTS = ["Menlo", "Menlo Bold"];
const CONTEXT = { count: 0, fonts: FONTS };

function spec(answers, problems = [], context = CONTEXT) {
    return formSpec(answers, problems, context);
}

test("the form is titled for the action that put it there", () => {
    assert.equal(spec().title, "Stamp Images");
});

test("the buttons say what will happen, and what will not", () => {
    assert.deepEqual(spec().buttons, [CREATE_BUTTON, CANCEL_BUTTON]);
    assert.deepEqual(spec().buttons, ["Create", "Cancel"]);
});

test("the invitation says how many photographs Cancel would call off", () => {
    // Selecting a folder can mean a great many, and this is the only place
    // between the selection and the work where a run can be stopped.
    assert.match(invitation(20), /^You have selected 20 images\./u);
    assert.match(invitation(1), /^You have selected 1 image\./u);
    assert.match(invitation(0), /^Choose what to stamp and how it should look\./u);
});

test("every invitation says what is being asked for", () => {
    for (const count of [0, 1, 20]) {
        assert.match(invitation(count), /Each image gets a stamped copy, saved in each folder you selected or beside each image you selected\. The original files are not changed\./u);
    }
});

test("every invitation says where the words on the stamp come from", () => {
    // Two of the ten rows choose how something is written rather than what it
    // says, and a form whose first two controls offer "2026-09-09 14:30"
    // reads as though it were asking which date to stamp. The photograph
    // answers that; this is the only place that can say so.
    for (const count of [0, 1, 20]) {
        assert.match(
            invitation(count),
            /The date and place come from each image's own metadata; the formats below are examples\./u
        );
        assert.match(
            invitation(count),
            /Leaving GPS coordinates off does not remove location data already in the image\./u
        );
    }
});

test("a form with corrections retains its selection and output contract", () => {
    const shown = spec(
        defaultAnswers(FONTS),
        [
            { key: "size", message: "Text size: enter a whole number from 8 to 400." },
            { key: "textColour", message: "Text colour must be six hexadecimal digits." }
        ],
        { count: 3, fonts: FONTS }
    );

    assert.match(shown.detail, /Text size: enter a whole number/u);
    assert.match(shown.detail, /Text colour must be six/u);
    assert.match(shown.detail, /You have selected 3 images/u);
    assert.match(shown.detail, /The original files are not changed/u);
    assert.match(shown.detail, /does not remove location data/u);
});

test("the rows carry the answers and the marks for the problems", () => {
    const shown = spec(
        { ...defaultAnswers(FONTS), customText: "Riga" },
        [{ key: "size", message: "wrong" }],
        { count: 1, fonts: FONTS }
    );
    const row = (key) => shown.rows.find((each) => each.key === key);

    assert.equal(row("customText").value, "Riga");
    assert.equal(row("size").invalid, true);
    assert.equal(row("margin").invalid, false);
    assert.equal(row("font").options.length, 2);
});

test("a form asked for with no answers shows the defaults, fonts and all", () => {
    // Taken without the fonts, the typeface row said nothing while the control
    // beside it showed a face.
    const shown = spec();

    assert.equal(shown.rows.length, 10);
    assert.equal(shown.rows.find((row) => row.key === "size").value, "36");
    assert.equal(shown.rows.find((row) => row.key === "font").value, "Menlo");
});
