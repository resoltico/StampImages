"use strict";

/*
 * Room for the explicit inclusion checkbox and full format labels. The native
 * form integration test measures actual cells, not guessed character counts.
 */
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 190;
const CONTROL_WIDTH = 300;
const NUMBER_WIDTH = 70;

// Room for a colour and the button that opens the list beside it. Wider than
// a number and far narrower than a menu of names, which is what the list held
// before its items became the colours themselves.
const COLOUR_WIDTH = 100;

// A family name and the button that opens the suggestions, with the rest of
// the column left for the hint that says a name may be typed instead.
// Measured through AppKit rather than guessed: "Helvetica Neue Bold", the
// longest face the list offers, asks for exactly 165 points, and the hint
// beside it asks for 82 of the 87 that leaves.
const FONT_WIDTH = 165;

// A caption is longer than a number, so it takes the whole column -- and it
// is the one setting that can hold more than a line, so it is deeper too.
const TEXT_WIDTH = CONTROL_WIDTH;
const CAPTION_LINES = 3;
const CAPTION_HEIGHT = 52;
const CONTROL_HEIGHT = 24;
const HINT_HEIGHT = 16;
const GAP = 10;
const HINT_GAP = 8;
const PADDING = 6;

// Padding sits above and below; a hint is centred against its field.
const BOTH_EDGES = 2;
const HALVES = 2;

const CONTROL_LEFT = LABEL_WIDTH + GAP;
const FORM_WIDTH = CONTROL_LEFT + CONTROL_WIDTH;

/*
 * A hint sits past the control it belongs to and stops at the edge of the
 * form. Derived from that control's width rather than from a fixed one: two
 * rows are typed into now, and they are not the same width.
 */
function hintRect(rect, controlWidth) {
    const left = CONTROL_LEFT + controlWidth + HINT_GAP;

    return {
        left,
        bottom: rect.bottom + (CONTROL_HEIGHT - HINT_HEIGHT) / HALVES,
        width: FORM_WIDTH - left,
        height: HINT_HEIGHT
    };
}

/*
 * The caption is three rows deep, so every row above it sits that much
 * higher. Stated as a number of rows rather than a number of points, because
 * what has to add up is the layout rather than the arithmetic.
 */
function rowsBelow(index, rowCount, caption) {
    const rows = rowCount - index - 1;

    return index < caption ? rows + CAPTION_LINES - 1 : rows;
}

function rowRect(at, column) {
    return {
        left: column.left,
        bottom: PADDING + rowsBelow(at.index, at.rowCount, at.caption) * ROW_HEIGHT,
        width: column.width,
        height: CONTROL_HEIGHT
    };
}

/*
 * The view the rows sit in: as wide as the form and as tall as it has rows,
 * with the padding above and below.
 */
function formSize(rowCount) {
    return {
        width: FORM_WIDTH,
        height: (rowCount + CAPTION_LINES - 1) * ROW_HEIGHT + PADDING * BOTH_EDGES
    };
}

// The name of a setting, in the column before its control.
function labelRect(at) {
    return rowRect(at, { left: 0, width: LABEL_WIDTH });
}

// The column a control is laid out in, whatever width it ends up taking.
function controlRect(at) {
    return rowRect(at, { left: CONTROL_LEFT, width: CONTROL_WIDTH });
}

module.exports = {
    ROW_HEIGHT,
    PADDING,
    COLOUR_WIDTH,
    FONT_WIDTH,
    TEXT_WIDTH,
    CAPTION_HEIGHT,
    CAPTION_LINES,
    NUMBER_WIDTH,
    FORM_WIDTH,
    formSize,
    labelRect,
    controlRect,
    hintRect
};
