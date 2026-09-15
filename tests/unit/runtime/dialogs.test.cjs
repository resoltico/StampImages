"use strict";

/*
 * The same questions, one at a time, when the form cannot be shown.
 *
 * Ten dialogs is a tedious way to answer ten questions and it is still a
 * working tool: an action whose interface disappears entirely is worse. The
 * questions and their order come from the same description the form is built
 * from, because two front ends that could drift apart would be two products.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { collectDialogSettings } = require("../../../src/runtime/dialogs.js");
const { ORDER } = require("../../../src/core/form-rows.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");

const FONTS = ["Menlo", "Menlo Bold"];

function asked(app) {
    return { lists: app.listPrompts.length, boxes: app.dialogs.length };
}

test("every row is asked, and the choices are chosen from a list", () => {
    const app = createFakeApp();
    const settings = collectDialogSettings(app, defaultAnswers(FONTS), askingContext(FONTS));
    // The typeface is typed here, like a colour: a dialog cannot offer a list
    // and a field at once, and a name nothing checked was the worse half.
    const chosen = ORDER.filter((row) => row.kind === "choice").length;

    assert.deepEqual(asked(app), {
        lists: chosen,
        boxes: ORDER.length - chosen
    });
    assert.equal(settings.position, "bottom-right");
    assert.equal(settings.font, "Menlo");
});

test("the questions are asked in the order the form lays them out", () => {
    const app = createFakeApp();

    collectDialogSettings(app, defaultAnswers(FONTS), askingContext(FONTS));

    assert.match(app.listPrompts[0].settings.withPrompt, /the date the photograph was taken/u);
    assert.match(app.dialogs[0].message, /Text of your own to stamp/u);
});

test("each question opens on the answer it was given", () => {
    // Which are the last run's when there are any, so the tedium is mostly
    // pressing Return.
    const app = createFakeApp();
    const opening = { ...defaultAnswers(FONTS), size: "72", customText: "Riga" };

    collectDialogSettings(app, opening, askingContext(FONTS));

    const boxes = app.dialogs.map((dialog) => dialog.options.defaultAnswer);

    assert.ok(boxes.includes("72"), boxes.join(" | "));
    assert.ok(boxes.includes("Riga"), boxes.join(" | "));
});

test("what may be typed is decided by the reader the form uses", () => {
    // So a colour refused in one front end is refused in the other, in the
    // same words.
    const app = createFakeApp();

    // The typeface is typed now too, and the caption is asked for before it.
    app.nextAnswer = ["", "Menlo", "huge", "36", "#FFFFFF", "2", "#202020", "24"];

    const settings = collectDialogSettings(app, defaultAnswers(FONTS), askingContext(FONTS));

    assert.equal(settings.size, 36);
    assert.ok(
        app.dialogs.some((dialog) => (/enter a whole number/u).test(dialog.message)),
        "the rejection says what is wrong with what was typed"
    );
});

test("the typeface is typed here too, and checked the same way", () => {
    // It used to be a list, because a dialog cannot offer a list and a field
    // at once -- which left this the one path where a family somebody already
    // uses could not be named, and the one path where nothing checked the
    // answer at all.
    const app = createFakeApp();

    collectDialogSettings(app, defaultAnswers(FONTS), askingContext(FONTS));

    const typeface = app.dialogs.find(
        (dialog) => String(dialog.message).startsWith("Typeface")
    );

    assert.ok(typeface, "the typeface was asked for in a field");
    assert.deepEqual(
        app.listPrompts.filter(
            (prompt) => prompt.settings.withPrompt.startsWith("Typeface")
        ),
        [],
        "and not offered as a list"
    );
});

test("answers are read together at the end, not one at a time", () => {
    // The last question can invalidate an earlier answer -- a margin that no
    // longer fits, say -- so what is returned is what the whole set reads as.
    const app = createFakeApp();
    const settings = collectDialogSettings(app, defaultAnswers(FONTS), askingContext(FONTS));

    assert.deepEqual(Object.keys(settings).sort(), ORDER.map((row) => row.key).sort());
});

test("a typeface this Mac has not is re-asked, not carried to the end", () => {
    // The fallback used to be the one path where nothing checked the answer:
    // it would have accepted the name, closed, and failed the run several
    // questions later.
    const app = createFakeApp();

    app.nextAnswer = ["", "Zapfino", "Menlo", "36", "#FFFFFF", "2", "#202020", "24"];

    const settings = collectDialogSettings(
        app,
        defaultAnswers(FONTS),
        askingContext(FONTS)
    );

    assert.equal(settings.font, "Menlo");
    assert.ok(
        app.dialogs.some((dialog) => (/does not draw with the typeface/u).test(dialog.message)),
        "and it said why"
    );
});
