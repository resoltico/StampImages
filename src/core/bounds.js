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
