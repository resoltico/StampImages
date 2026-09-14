"use strict";

const { ORDER } = require("./form-rows.js");
const { defaultLabelOf, defaultValueOf } = require("./choices.js");

/*
 * What the form opens on when there is nothing to open on.
 *
 * Said twice, because two readers want it in two shapes: the controls want
 * answers -- a choice as the words it is offered under, a number as its text
 * -- and a remembered record is filled in against settings, which is what the
 * pipeline stores. Both are read off the same list of rows, so a row added to
 * the form cannot be missing from either.
 */

function defaultFor(row, fonts) {
    if (row.kind === "font") {
        return fonts.length > 0 ? fonts[0] : "";
    }

    return row.kind === "choice"
        ? defaultLabelOf(row.control)
        : row.control.defaultAnswer;
}

function defaultAnswers(fonts) {
    return Object.fromEntries(
        ORDER.map((row) => [row.key, defaultFor(row, fonts)])
    );
}

/*
 * The same defaults as settings rather than as answers, so a record written by
 * a version that knew one setting fewer is still a record.
 */
function defaultSettingFor(row, fonts) {
    if (row.kind === "font") {
        return fonts.length > 0 ? fonts[0] : "";
    }

    if (row.kind === "choice") {
        return defaultValueOf(row.control);
    }

    return row.kind === "number"
        ? Number(row.control.defaultAnswer)
        : row.control.defaultAnswer;
}

function defaultSettings(fonts) {
    return Object.fromEntries(
        ORDER.map((row) => [row.key, defaultSettingFor(row, fonts)])
    );
}

module.exports = { defaultAnswers, defaultSettings };
