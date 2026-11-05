"use strict";

/*
 * The three settings that are a number between two others.
 *
 * Apart from the lists because they are a different sort of question: a list
 * is answered by picking, and these are answered by typing, with the bound
 * beside the field saying what will be accepted. The bounds are stated once
 * here and read by the form, the readers and the settings alike, so a rule
 * shown to somebody is the rule their answer is measured against.
 */

const { SETTINGS_SCHEMA } = require("../core/settings.js");
const MINIMUM_SIZE = SETTINGS_SCHEMA.size.minimum;
const MAXIMUM_SIZE = SETTINGS_SCHEMA.size.maximum;
const MINIMUM_MARGIN = SETTINGS_SCHEMA.margin.minimum;
const MAXIMUM_MARGIN = SETTINGS_SCHEMA.margin.maximum;
const MINIMUM_OUTLINE = SETTINGS_SCHEMA.outlineWidth.minimum;
const MAXIMUM_OUTLINE = SETTINGS_SCHEMA.outlineWidth.maximum;

/*
 * Text size is in points at the image's own scale, not a fraction of it: a
 * stamp that is a percentage of the picture is a different size on every
 * photograph in the batch, which is the opposite of what a batch is for.
 */
const SIZE = {
    prompt: `Text size in points (${MINIMUM_SIZE}-${MAXIMUM_SIZE}):`,
    label: "Text size:",
    hint: `${MINIMUM_SIZE}-${MAXIMUM_SIZE} pt`,
    defaultAnswer: String(SETTINGS_SCHEMA.size.default),
    minimum: MINIMUM_SIZE,
    maximum: MAXIMUM_SIZE
};

const MARGIN = {
    prompt: `Margin in pixels (${MINIMUM_MARGIN}-${MAXIMUM_MARGIN}):`,
    label: "Margin:",
    hint: `${MINIMUM_MARGIN}-${MAXIMUM_MARGIN} px`,
    defaultAnswer: String(SETTINGS_SCHEMA.margin.default),
    minimum: MINIMUM_MARGIN,
    maximum: MAXIMUM_MARGIN
};

const OUTLINE_WIDTH = {
    prompt: `Outline width in pixels (${MINIMUM_OUTLINE}-${MAXIMUM_OUTLINE}):`,
    label: "Outline:",
    hint: `${MINIMUM_OUTLINE}-${MAXIMUM_OUTLINE} px, 0 for none`,
    defaultAnswer: String(SETTINGS_SCHEMA.outlineWidth.default),
    minimum: MINIMUM_OUTLINE,
    maximum: MAXIMUM_OUTLINE
};

module.exports = {
    SIZE,
    MARGIN,
    OUTLINE_WIDTH,
    MINIMUM_SIZE,
    MAXIMUM_SIZE,
    MINIMUM_MARGIN,
    MAXIMUM_MARGIN,
    MINIMUM_OUTLINE,
    MAXIMUM_OUTLINE
};
