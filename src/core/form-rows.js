"use strict";

const { choiceRow, colourRow, numberRow, textRow } = require("./form-shapes.js");
const {
    POSITION,
    DATE_FORMAT,
    COORDINATE_FORMAT,
    SIZE,
    MARGIN,
    OUTLINE_WIDTH,
    labelOfValue
} = require("./choices.js");

/*
 * What the form asks, described as data.
 *
 * Which rows exist, what they are called, what may be chosen and what the
 * answers start out as. Everything decidable without AppKit is decided here,
 * so the runtime layer only has to turn a description into widgets -- the
 * part that cannot be tested headlessly.
 *
 * One list. The rows used to be written down twice, once grouped by kind for
 * the defaults and once in reading order for the form, and two lists that must
 * agree are one list and a bug waiting to be written.
 */

// No choices of its own: which faces exist is a fact about the machine, and
// fontControl below is where they are put in.
const FONT = {
    prompt: "Typeface:",
    label: "Typeface:"
};

/*
 * Every control says what it is asking twice over: the prompt is a sentence
 * for the stepwise dialogs, and the label is a column heading in the form.
 * The ones that had no prompt fell back to their label, which reads as a
 * heading in a dialog and left a branch nothing chose deliberately.
 */
const TEXT = {
    prompt: "Text of your own to stamp:",
    label: "Your own text:",
    defaultAnswer: ""
};

/*
 * A few colours worth having at hand, and the control takes any other.
 *
 * The list holds the colours themselves rather than names for them: a menu of
 * "White", "Black", "Warning yellow" is a menu of somebody's vocabulary, and
 * the thing being chosen is a value that can equally be typed. Which is also
 * why they are presets in a control that is a field, rather than a menu with a
 * "Custom..." item that makes a second control appear.
 */
const TEXT_COLOUR = {
    prompt: "Colour of the text:",
    label: "Text colour:",
    defaultAnswer: "#FFFFFF",
    presets: ["#FFFFFF", "#000000", "#FFD400", "#FF3B30"]
};

const OUTLINE_COLOUR = {
    prompt: "Colour of the outline:",
    label: "Outline colour:",
    defaultAnswer: "#202020",
    presets: ["#202020", "#000000", "#FFFFFF"]
};

/*
 * The order a person thinks in: what the stamp says, then what it looks like,
 * then where it goes. Reading them in the order the program uses them would
 * put the margin beside the typeface.
 */
const ORDER = [
    { kind: "choice", key: "dateFormat", control: DATE_FORMAT },
    { kind: "choice", key: "coordinateFormat", control: COORDINATE_FORMAT },
    { kind: "text", key: "customText", control: TEXT },
    { kind: "font", key: "font", control: FONT },
    { kind: "number", key: "size", control: SIZE },
    { kind: "colour", key: "textColour", control: TEXT_COLOUR },
    { kind: "number", key: "outlineWidth", control: OUTLINE_WIDTH },
    { kind: "colour", key: "outlineColour", control: OUTLINE_COLOUR },
    { kind: "choice", key: "position", control: POSITION },
    { kind: "number", key: "margin", control: MARGIN }
];

/*
 * The typefaces are not written down here. Which ones exist is a fact about
 * the machine, established by drawing with each of them, so the list arrives
 * with the answers rather than being a constant that might name a font this
 * Mac would quietly render as something else.
 */
function fontControl(fonts) {
    return {
        ...FONT,
        choices: fonts.map((font) => ({ label: font, value: font }))
    };
}

/*
 * The typeface row, with the machine's answer in it. Every reader of a row
 * goes through here, so nothing else has to know that one of the ten is only
 * a list once the fonts are known.
 */
function resolvedRow(row, fonts) {
    return row.kind === "font" ? { ...row, control: fontControl(fonts) } : row;
}

function controlFor(row, fonts) {
    return resolvedRow(row, fonts).control;
}

const BUILDERS = {
    choice: choiceRow,
    font: choiceRow,
    colour: colourRow,
    number: numberRow,
    text: textRow
};

function formRows(answers, invalid, fonts) {
    return ORDER.map((row) => {
        const resolved = resolvedRow(row, fonts);

        return BUILDERS[row.kind](resolved, answers, invalid);
    });
}

module.exports = {
    ORDER,
    fontControl,
    resolvedRow,
    controlFor,
    formRows,
    labelOfValue
};
