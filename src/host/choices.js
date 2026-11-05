"use strict";

/*
 * What a person may choose, and the words they choose it by.
 *
 * The label is what is read and the value is what the pipeline stores; the
 * two are deliberately not the same word, so renaming what a control says
 * cannot change what the program does with it.
 */

const { SETTINGS_SCHEMA } = require("../core/settings.js");
function choicesFor(field, labels) {
    return SETTINGS_SCHEMA[field].choices.map(({ value }) => ({ value, label: labels[value] }));
}
const POSITIONS = choicesFor("position", {
    "bottom-right": "Bottom right", "bottom-left": "Bottom left", "top-right": "Top right", "top-left": "Top left",
    "bottom-centre": "Bottom centre", "top-centre": "Top centre"
});
const DATE_FORMATS = choicesFor("dateFormat", { "iso-minutes": "2026-09-09 14:30", "iso-date": "2026-09-09", "long-date": "9 September 2026", none: "Do not stamp the date" });
const COORDINATE_FORMATS = choicesFor("coordinateFormat", { none: "Do not stamp the coordinates", decimal: "56.9496, 24.1052", sexagesimal: "56°56'58.6\"N 24°6'18.7\"E" });

const POSITION = {
    prompt: "Where the stamp goes:",
    label: "Position:",
    choices: POSITIONS
};

// Named for what they choose, which is a format: "Date:" over a menu of
// "2026-09-09 14:30" reads as though it were asking which date to stamp, and
// it is neither. Where the values come from is the form's opening line.
const DATE_FORMAT = {
    prompt: "Date/time format (these are examples, not dates to stamp):",
    label: "Date/time format:",
    choices: DATE_FORMATS
};

const COORDINATE_FORMAT = {
    prompt: "Coordinate format (latitude, then longitude):",
    label: "Coordinate format:",
    optional: {
        label: "Include GPS coordinates",
        offValue: "none",
        help: "Adds the place to the stamp. Leaving it off does not remove " +
            "location data already in the image."
    },
    choices: COORDINATE_FORMATS
};

/*
 * The typeface is not here, and neither is a weight. A closed choice is one
 * where this program knows every answer, and which faces a Mac has is a fact
 * about that Mac -- see typeface.js. A weight setting lived here briefly and
 * offered Regular and Bold, which reaches two of Avenir's twelve faces and
 * none of the named instances of a variable font.
 */
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
    labelsOf,
    defaultLabelOf,
    defaultValueOf,
    valueOfLabel,
    labelOfValue
};
