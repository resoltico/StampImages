"use strict";

/*
 * Asking one question at a time, where there is no form to ask ten at once.
 *
 * What was typed comes back in the box: asking again with the original default
 * in its place throws away the one thing the person has that the program does
 * not -- the value they were correcting.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { chooseRequired, askUntil } = require("../../../src/runtime/prompts.js");
const { POSITION } = require("../../../src/core/choices.js");
const { createFakeApp } = require("./fake-app.cjs");

function question(prompt = "Text size:", defaultAnswer = "36") {
    return { prompt, defaultAnswer };
}

function digits(answer) {
    if (!(/^\d+$/u).test(answer)) {
        throw new Error("Text size: enter a whole number from 8 to 400.");
    }

    return Number(answer);
}

test("a list answers with the label chosen, which is what a control shows", () => {
    // Not the value behind it: the whole set of answers is read into settings
    // once, at the end, by the reader the form uses.
    const app = createFakeApp();

    app.nextChoice = ["Top left"];
    assert.equal(chooseRequired(app, POSITION, "Bottom right"), "Top left");
});

test("an answer that was never offered is refused at the question", () => {
    const app = createFakeApp();

    app.nextChoice = ["Sideways"];
    assert.throws(
        () => chooseRequired(app, POSITION, "Bottom right"),
        /Unrecognised choice: Sideways/u
    );
});

test("the list opens on what it was told to open on", () => {
    const app = createFakeApp();

    chooseRequired(app, POSITION, "Top right");

    const [asked] = app.listPrompts;

    assert.deepEqual(asked.options, [
        "Bottom right",
        "Bottom left",
        "Top right",
        "Top left",
        "Bottom centre",
        "Top centre"
    ]);
    assert.deepEqual(asked.settings.defaultItems, ["Top right"]);
    assert.equal(asked.settings.withTitle, "Stamp Images");
    assert.equal(asked.settings.withPrompt, POSITION.prompt);
});

test("dismissing the list is a cancellation, not an empty answer", () => {
    const app = createFakeApp();

    app.nextChoice = false;
    assert.throws(() => chooseRequired(app, POSITION, "Bottom right"), /cancelled/iu);
});

test("an answer that can be read is the answer", () => {
    const app = createFakeApp();

    app.nextAnswer = "72";
    assert.equal(askUntil(app, question(), digits), 72);
    assert.equal(app.dialogs.length, 1);
});

test("the box opens holding what it was told to open with", () => {
    const app = createFakeApp();

    app.nextAnswer = "72";
    askUntil(app, question(), digits);

    assert.deepEqual(app.dialogs[0].options, {
        withTitle: "Stamp Images",
        defaultAnswer: "36",
        buttons: ["Cancel", "OK"],
        defaultButton: "OK",
        cancelButton: "Cancel"
    });
});

test("what was typed comes back, with the reason above the question", () => {
    // An answer and what is wrong with it belong on one screen rather than on
    // two in turn, which is what the form does with its problems.
    const app = createFakeApp();

    app.nextAnswer = ["huge", "72"];

    assert.equal(askUntil(app, question(), digits), 72);
    assert.equal(app.dialogs.length, 2);
    assert.equal(app.dialogs[1].options.defaultAnswer, "huge", "not the default");
    assert.match(app.dialogs[1].message, /^Text size: enter a whole number/u);
    assert.match(app.dialogs[1].message, /\n\nText size:$/u);
});

test("it keeps asking until it can read the answer", () => {
    const app = createFakeApp();

    app.nextAnswer = ["huge", "-4", "0x12C", "72"];
    assert.equal(askUntil(app, question(), digits), 72);
    assert.equal(app.dialogs.length, 4);
});

test("cancelling is a decision, not an unusable answer", () => {
    // displayDialog raises when the person cancels, and that raise is not
    // caught: asking again would be refusing to take no for an answer.
    const app = createFakeApp();

    app.nextAnswer = [new Error("User cancelled.")];
    assert.throws(() => askUntil(app, question(), digits), /User cancelled/u);
    assert.equal(app.dialogs.length, 1);
});
