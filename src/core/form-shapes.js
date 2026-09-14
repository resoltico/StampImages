"use strict";

/*
 * What a row of the form looks like, by kind.
 *
 * Four kinds and nothing else: something chosen from a list, a colour, a
 * number with bounds, and text written freely. Each is a plain object,
 * because the runtime layer's job is to turn one into a widget and it should
 * not have to ask questions to do it.
 */

function choiceRow({ key, control }, answers, invalid) {
    return {
        key,
        kind: "choice",
        label: control.label,
        value: String(answers[key]),
        invalid: invalid.has(key),
        options: control.choices.map((choice) => ({ label: choice.label }))
    };
}

function colourRow({ key, control }, answers, invalid) {
    return {
        key,
        kind: "colour",
        label: control.label,
        hint: "or type #RRGGBB",
        value: String(answers[key]),
        invalid: invalid.has(key),
        options: control.presets.map((colour) => ({ label: colour }))
    };
}

function numberRow({ key, control }, answers, invalid) {
    return {
        key,
        kind: "number",
        label: control.label,
        hint: control.hint,
        value: String(answers[key]),
        invalid: invalid.has(key),
        minimum: control.minimum,
        maximum: control.maximum
    };
}

/*
 * The one setting written freely rather than chosen. It takes the whole
 * control column, because a caption is longer than a number -- which leaves no
 * room beside it for a hint, and it needs none: what may be typed here is
 * anything, and a field somebody may leave empty does not have to say so.
 */
function textRow({ key, control }, answers, invalid) {
    return {
        key,
        kind: "text",
        label: control.label,
        value: String(answers[key]),
        invalid: invalid.has(key)
    };
}

module.exports = { choiceRow, colourRow, numberRow, textRow };
