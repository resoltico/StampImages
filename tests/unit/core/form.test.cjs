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
} = require("../../../src/host/quick-action/form.js");
const { defaultAnswers } = require("../../../src/host/quick-action/settings-model.js");

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

test("the invitation says how many images Cancel would call off, and where copies go", () => {
    // Selecting a folder can mean a great many, and this is the only place
    // between the selection and the work where a run can be stopped. Worded
    // as Image Files to PDF states its outcome.
    assert.match(invitation({ count: 20, folders: ["/Trip/"] }),
        /^20 images → 20 stamped copies, saved in Trip\/\n\nSave locations:\n\/Trip\/\n\n/u);
    assert.match(invitation({ count: 1, folders: ["/a/"] }), /^1 image → 1 stamped copy, saved in a\//u);
    assert.match(invitation({ count: 3, folders: ["/a/", "/b/"] }), /saved in 2 folders\n\nSave locations:\n\/a\/\n\/b\//u);
    assert.match(invitation({ count: 0 }), /^Choose what to stamp and how it should look\./u);
    assert.match(invitation(), /^Choose what to stamp/u);
});

test("every invitation says the originals are not changed", () => {
    for (const context of [{ count: 0 }, { count: 1, folders: ["/a/"] }, { count: 20, selectedFolders: 1 }]) {
        assert.match(invitation(context), /The original files are not changed\./u);
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
            { key: "textColor", message: "Text color must be six hexadecimal digits." }
        ],
        { count: 3, fonts: FONTS }
    );

    assert.match(shown.fullDetail, /Text size: enter a whole number/u);
    assert.match(shown.fullDetail, /Text color must be six/u);
    assert.match(shown.fullDetail, /You have selected 3 images/u);
    assert.match(shown.fullDetail, /The original files are not changed/u);
    assert.match(shown.fullDetail, /does not remove location data/u);
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

test("several corrections are counted above the controls and listed in the note", () => {
    const shown = formSpec(undefined, [{ key: "size", message: "A." }, { key: "margin", message: "B." }], { count: 1, fonts: [] });

    assert.equal(shown.detail, "Correct the 2 highlighted settings, listed below.");
    assert.match(shown.fullDetail, /^A\.\nB\.\n/u);
});
