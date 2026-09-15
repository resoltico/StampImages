"use strict";

/*
 * What a row of the form looks like, by kind.
 *
 * Five kinds and nothing else: something chosen from a list, a typeface, a
 * colour, a number with bounds, and text written freely. Each is a plain
 * object, because the runtime layer's job is to turn one into a widget and it
 * should not have to ask questions to do it.
 *
 * A list is either the whole of what may be chosen or a few worth having at
 * hand, and the difference is the kind rather than the shape: the position and
 * the two formats are closed, the typeface and the colours are open and carry
 * a hint saying what may be typed instead. One builder serves all three sorts
 * of list, because a row that offers names is a row that offers names.
 */

function listRow({ kind, key, control }, answers, invalid) {
    return {
        key,
        kind,
        label: control.label,
        hint: control.hint,
        value: String(answers[key]),
        invalid: invalid.has(key),
        options: (control.choices ?? control.presets).map(
            (option) => ({ label: option.label ?? option })
        )
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

module.exports = { listRow, numberRow, textRow };
