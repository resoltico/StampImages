"use strict";

/*
 * What a setting means, and validation of whatever arrives -- from the form,
 * from a remembered run, or from a headless caller.
 *
 * One validator, so a value refused in one place cannot be accepted in
 * another, and everything it returns is what the pipeline stores.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    normalizeSettings,
    stampsNothing,
    CUSTOM_TEXT_LIMIT
} = require("../../../src/core/settings.js");

const GOOD = {
    font: "Helvetica Neue",
    size: 36,
    textColour: "#FFFFFF",
    outlineColour: "#000000",
    outlineWidth: 2,
    position: "bottom-right",
    margin: 24,
    dateFormat: "iso-minutes",
    coordinateFormat: "decimal",
    customText: "Riga"
};

function normalized(overrides = {}) {
    return normalizeSettings({ ...GOOD, ...overrides });
}

test("what comes back is what the pipeline stores, in its own types", () => {
    assert.deepEqual(normalized(), { ...GOOD });
});

test("a number written as text is a number afterwards", () => {
    const settings = normalized({ size: "36", margin: "24", outlineWidth: "0" });

    assert.equal(settings.size, 36);
    assert.equal(settings.margin, 24);
    assert.equal(settings.outlineWidth, 0);
});

test("a number outside its bounds is refused by name", () => {
    assert.throws(() => normalized({ size: 7 }), /Text size/u);
    assert.throws(() => normalized({ size: 401 }), /Text size/u);
    assert.throws(() => normalized({ margin: -1 }), /Margin/u);
    assert.throws(() => normalized({ margin: 2001 }), /Margin/u);
    assert.throws(() => normalized({ outlineWidth: 21 }), /Outline/u);
});

test("a colour is canonical however it was written", () => {
    const settings = normalized({ textColour: "ff8000", outlineColour: " #ffffff " });

    assert.equal(settings.textColour, "#FF8000");
    assert.equal(settings.outlineColour, "#FFFFFF");
});

test("something that is not a colour is refused by name", () => {
    assert.throws(() => normalized({ textColour: "sky" }), /Text colour/u);
    assert.throws(() => normalized({ outlineColour: "#12345" }), /Outline colour/u);
    // Shorthand is refused rather than guessed at: #FFF is as readily an
    // unfinished #FFF000 as it is white.
    assert.throws(() => normalized({ textColour: "#FFF" }), /Text colour/u);
});

test("a choice nothing offers is refused rather than passed on", () => {
    assert.throws(() => normalized({ position: "middle" }), /Unsupported position/u);
    assert.throws(
        () => normalized({ dateFormat: "rfc822" }),
        /Unsupported date format/u
    );
    assert.throws(
        () => normalized({ coordinateFormat: "utm" }),
        /Unsupported coordinate format/u
    );
});

test("a font is taken as typed, less the spaces around it", () => {
    assert.equal(normalized({ font: "  Menlo Bold  " }).font, "Menlo Bold");
    assert.equal(normalized({ font: undefined }).font, "");
});

test("custom text is bounded, because a stamp is a caption", () => {
    // Unbounded, it renders a text image larger than the photograph.
    const long = "x".repeat(CUSTOM_TEXT_LIMIT);

    assert.equal(normalized({ customText: long }).customText, long);
    assert.throws(
        () => normalized({ customText: `${long}x` }),
        new RegExp(`${CUSTOM_TEXT_LIMIT} characters or fewer`, "u")
    );
});

test("no custom text at all is empty text, not a failure", () => {
    assert.equal(normalized({ customText: undefined }).customText, "");
    assert.equal(normalized({ customText: null }).customText, "");
});

test("a request that would stamp nothing is one to refuse", () => {
    // A run that copies photographs and draws nothing on them is a run that
    // copied photographs for no reason.
    assert.equal(
        stampsNothing(normalized({
            dateFormat: "none",
            coordinateFormat: "none",
            customText: "   \n  "
        })),
        true
    );
});

test("any one of the three is enough to be worth stamping", () => {
    const nothing = { dateFormat: "none", coordinateFormat: "none", customText: "" };

    assert.equal(stampsNothing(normalized({ ...nothing, dateFormat: "iso-date" })), false);
    assert.equal(
        stampsNothing(normalized({ ...nothing, coordinateFormat: "decimal" })),
        false
    );
    assert.equal(stampsNothing(normalized({ ...nothing, customText: "Riga" })), false);
});

test("a value of the wrong kind is refused by the name of its setting", () => {
    // Ten settings are listed together, and one that does not name itself is
    // a sentence about nothing.
    for (const [key, said] of [
        ["size", "Text size must be a number"],
        ["margin", "Margin must be a number"],
        ["outlineWidth", "Outline must be a number"],
        ["font", "The typeface must be text"],
        ["customText", "Your own text must be text"],
        ["position", "The position must be text"],
        ["dateFormat", "The date format must be text"],
        ["coordinateFormat", "The coordinate format must be text"]
    ]) {
        assert.throws(
            () => normalized({ [key]: [] }),
            new RegExp(said, "u"),
            key
        );
    }
});
