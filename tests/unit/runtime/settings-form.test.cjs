"use strict";

/*
 * Which front end asks for the settings, and what a form that comes back with
 * problems does with them.
 *
 * The AppKit form is preferred and the stepwise dialogs are the fallback. A
 * cancellation is an answer and must be honoured; anything else the form
 * throws is the form being unusable, because falling back to dialogs that work
 * is better than failing a run over a widget.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    collectViaForm,
    collectSettings
} = require("../../../src/runtime/settings-form.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { createFakeApp } = require("./fake-app.cjs");

const BRIDGE = { objc: {}, ns: {} };
const FONTS = ["Menlo", "Menlo Bold"];

/*
 * Stands in for the AppKit form: answers each presentation in turn, and
 * records the spec it was shown so a redisplay can be inspected.
 */
function scripted(outcomes) {
    const seen = [];
    const present = (bridge, spec) => {
        seen.push(spec);

        return outcomes.shift();
    };

    present.seen = seen;

    return present;
}

function opening(answers = defaultAnswers(FONTS)) {
    return { answers, context: { count: 1, fonts: FONTS } };
}

test("the form's answers become the settings", () => {
    const present = scripted([{ answers: defaultAnswers(FONTS) }]);
    const settings = collectViaForm(BRIDGE, present, opening());

    assert.equal(settings.dateFormat, "iso-minutes");
    assert.equal(settings.size, 36);
    assert.equal(present.seen.length, 1);
});

test("a form with something wrong comes back with everything filled in", () => {
    // Correcting a mistyped size must not mean answering the other nine again.
    const typed = { ...defaultAnswers(FONTS), size: "huge", customText: "Riga" };
    const present = scripted([
        { answers: typed },
        { answers: { ...typed, size: "48" } }
    ]);
    const settings = collectViaForm(BRIDGE, present, opening());

    assert.equal(settings.size, 48);
    assert.equal(settings.customText, "Riga");

    const [, second] = present.seen;

    assert.equal(second.rows.find((row) => row.key === "size").value, "huge");
    assert.equal(second.rows.find((row) => row.key === "customText").value, "Riga");
});

test("every problem is shown at once, marked on the rows they are about", () => {
    const typed = { ...defaultAnswers(FONTS), size: "huge", textColour: "sky" };
    const present = scripted([
        { answers: typed },
        { answers: defaultAnswers(FONTS) }
    ]);

    collectViaForm(BRIDGE, present, opening());

    const [, second] = present.seen;
    const marked = second.rows.filter((row) => row.invalid).map((row) => row.key);

    assert.deepEqual(marked, ["size", "textColour"]);
    assert.match(second.detail, /Text size/u);
    assert.match(second.detail, /Text colour/u);
});

test("the count travels with the form, so Cancel is a decision", () => {
    const present = scripted([{ answers: defaultAnswers(FONTS) }]);

    collectViaForm(BRIDGE, present, {
        answers: defaultAnswers(FONTS),
        context: { count: 20, fonts: FONTS }
    });

    assert.match(present.seen[0].detail, /^20 photographs\./u);
});

test("a form that cannot be presented is not an answer", () => {
    assert.equal(collectViaForm(BRIDGE, scripted([null]), opening()), null);
});

test("cancelling the form ends the run rather than falling back", () => {
    assert.throws(
        () => collectViaForm(BRIDGE, scripted([{ cancelled: true }]), opening()),
        /cancelled/iu
    );
});

test("with no bridge at all the questions are asked one at a time", () => {
    const app = createFakeApp();
    const settings = collectSettings(app, opening(), { bridge: null, present: scripted([]) });

    assert.ok(app.listPrompts.length > 0, "the dialogs asked");
    assert.equal(settings.font, "Menlo");
});

test("a form that throws falls back to the dialogs", () => {
    // Anything but a cancellation is the form being unusable.
    const app = createFakeApp();
    const settings = collectSettings(app, opening(), {
        bridge: BRIDGE,
        present: () => {
            throw new Error("NSAlert would not init");
        }
    });

    assert.ok(app.listPrompts.length > 0);
    assert.equal(settings.position, "bottom-right");
});

test("a cancelled form is honoured even though dialogs would work", () => {
    assert.throws(
        () => collectSettings(createFakeApp(), opening(), {
            bridge: BRIDGE,
            present: scripted([{ cancelled: true }])
        }),
        /cancelled/iu
    );
});
