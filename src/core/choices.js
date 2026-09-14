"use strict";

/*
 * What a person may choose, and the words they choose it by.
 *
 * The label is what is read and the value is what the pipeline stores; the
 * two are deliberately not the same word, so renaming what a control says
 * cannot change what the program does with it.
 */

const POSITIONS = [
    { label: "Bottom right", value: "bottom-right" },
    { label: "Bottom left", value: "bottom-left" },
    { label: "Top right", value: "top-right" },
    { label: "Top left", value: "top-left" },
    { label: "Bottom centre", value: "bottom-centre" },
    { label: "Top centre", value: "top-centre" }
];

const DATE_FORMATS = [
    { label: "2026-09-09 14:30", value: "iso-minutes" },
    { label: "2026-09-09", value: "iso-date" },
    { label: "9 September 2026", value: "long-date" },
    { label: "Do not stamp the date", value: "none" }
];

const COORDINATE_FORMATS = [
    { label: "56.9496, 24.1052", value: "decimal" },
    { label: "56°56'58.6\"N 24°6'18.7\"E", value: "sexagesimal" },
    { label: "Do not stamp the coordinates", value: "none" }
];

const POSITION = {
    prompt: "Where the stamp goes:",
    label: "Position:",
    choices: POSITIONS
};

// Named for what they choose, which is a format: "Date:" over a menu of
// "2026-09-09 14:30" reads as though it were asking which date to stamp, or
// offering one it had already read, and it is neither. Where the values come
// from is the form's opening line. The items stay samples rather than names.
const DATE_FORMAT = {
    prompt: "How the date the photograph was taken is written:",
    label: "Date format:",
    choices: DATE_FORMATS
};

const COORDINATE_FORMAT = {
    prompt: "How the place the photograph was taken is written:",
    label: "Coordinate format:",
    choices: COORDINATE_FORMATS
};

const MINIMUM_SIZE = 8;
const MAXIMUM_SIZE = 400;
const MINIMUM_MARGIN = 0;
const MAXIMUM_MARGIN = 2000;
const MINIMUM_OUTLINE = 0;
const MAXIMUM_OUTLINE = 20;

/*
 * Text size is in points at the image's own scale, not a fraction of it: a
 * stamp that is a percentage of the picture is a different size on every
 * photograph in the batch, which is the opposite of what a batch is for.
 */
const SIZE = {
    prompt: `Text size in points (${MINIMUM_SIZE}-${MAXIMUM_SIZE}):`,
    label: "Text size:",
    hint: `${MINIMUM_SIZE}-${MAXIMUM_SIZE} pt`,
    defaultAnswer: "36",
    minimum: MINIMUM_SIZE,
    maximum: MAXIMUM_SIZE
};

const MARGIN = {
    prompt: `Margin in pixels (${MINIMUM_MARGIN}-${MAXIMUM_MARGIN}):`,
    label: "Margin:",
    hint: `${MINIMUM_MARGIN}-${MAXIMUM_MARGIN} px`,
    defaultAnswer: "24",
    minimum: MINIMUM_MARGIN,
    maximum: MAXIMUM_MARGIN
};

const OUTLINE_WIDTH = {
    prompt: `Outline width in pixels (${MINIMUM_OUTLINE}-${MAXIMUM_OUTLINE}):`,
    label: "Outline:",
    hint: `${MINIMUM_OUTLINE}-${MAXIMUM_OUTLINE} px, 0 for none`,
    defaultAnswer: "2",
    minimum: MINIMUM_OUTLINE,
    maximum: MAXIMUM_OUTLINE
};

function labelsOf(control) {
    return control.choices.map((choice) => choice.label);
}

function defaultLabelOf(control) {
    return control.choices[0].label;
}

function defaultValueOf(control) {
    return control.choices[0].value;
}

function valueOfLabel(control, label) {
    const chosen = control.choices.find((choice) => choice.label === label);

    if (!chosen) {
        throw new Error(`Unrecognised choice: ${label}`);
    }

    return chosen.value;
}

/*
 * The other way round, for a value coming back into the form: every control's
 * value is what the settings store, so a remembered one finds its own label
 * with nothing in between.
 */
function labelOfValue(control, value) {
    const chosen = control.choices.find((choice) => choice.value === value);

    if (!chosen) {
        throw new Error(`Unrecognised value: ${value}`);
    }

    return chosen.label;
}

module.exports = {
    POSITION,
    DATE_FORMAT,
    COORDINATE_FORMAT,
    SIZE,
    MARGIN,
    OUTLINE_WIDTH,
    MINIMUM_SIZE,
    MAXIMUM_SIZE,
    MINIMUM_MARGIN,
    MAXIMUM_MARGIN,
    MINIMUM_OUTLINE,
    MAXIMUM_OUTLINE,
    labelsOf,
    defaultLabelOf,
    defaultValueOf,
    valueOfLabel,
    labelOfValue
};
