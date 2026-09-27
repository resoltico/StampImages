"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { defaultAnswers, defaultSettings } = require("../../../src/core/form-defaults.js");
const { normalizeSettings } = require("../../../src/core/settings.js");
const { contentProblem, requireStampContent } = require("../../../src/core/stamp-content.js");
const { encode, rememberedAnswers } = require("../../../src/core/preferences.js");
const { readAnswers } = require("../../../src/core/answers.js");
const { selectionSummary } = require("../../../src/core/stamp-description.js");
const { formSpec, invitation } = require("../../../src/core/form.js");
const FONTS = ["Menlo"];

test("fresh settings stamp date/time only; GPS is off until someone turns it on", () => {
    const defaults = defaultSettings(FONTS);

    assert.equal(defaults.coordinateFormat, "none");
    assert.equal(defaults.dateFormat, "iso-minutes");
    assert.equal(defaults.customText, "");
    assert.equal(defaultAnswers(FONTS).coordinateFormat, "Do not stamp the coordinates");
});

test("a headless configuration must say whether to stamp coordinates", () => {
    const { coordinateFormat, ...withoutLocation } = defaultSettings(FONTS);

    assert.equal(coordinateFormat, "none");
    assert.throws(() => normalizeSettings(withoutLocation), /coordinate format/u);
});

test("headless coordinate opt-in must be an explicit valid mode", () => {
    const defaults = defaultSettings(FONTS);

    assert.equal(normalizeSettings({ ...defaults, coordinateFormat: "decimal" }).coordinateFormat, "decimal");
    assert.equal(normalizeSettings({ ...defaults, coordinateFormat: "sexagesimal" }).coordinateFormat, "sexagesimal");
    for (const bad of [null, true, false, "", "off", 0]) {
        assert.throws(() => normalizeSettings({ ...defaults, coordinateFormat: bad }));
    }
});

test("the GPS choice is remembered like the appearance; custom text is not", () => {
    for (const coordinateFormat of ["decimal", "sexagesimal", "none"]) {
        const held = { ...defaultSettings(FONTS), coordinateFormat, size: 72, customText: "private" };
        const persisted = JSON.parse(encode(held));
        const decoded = readAnswers(rememberedAnswers(encode(held), FONTS), FONTS).settings;

        assert.equal(persisted.coordinateFormat, coordinateFormat);
        assert.equal(Object.hasOwn(persisted, "customText"), false);
        assert.deepEqual({ mode: decoded.coordinateFormat, caption: decoded.customText, size: decoded.size },
            { mode: coordinateFormat, caption: "", size: 72 });
    }
});

test("a remembered GPS choice this version cannot read is no answer at all", () => {
    for (const coordinateFormat of ["obsolete", null]) {
        const held = { ...defaultSettings(FONTS), coordinateFormat, size: 72 };

        assert.equal(rememberedAnswers(JSON.stringify(held), FONTS), undefined);
    }
});

test("an empty remembered caption-only template remains editable, but cannot be approved", () => {
    const settings = { ...defaultSettings(FONTS), dateFormat: "none", customText: "a caption" };
    const recalled = rememberedAnswers(encode(settings), FONTS);
    const empty = readAnswers(recalled, FONTS).settings;

    assert.equal(empty.dateFormat, "none");
    assert.equal(empty.customText, "");
    assert.equal(contentProblem(empty).key, "customText");
    assert.throws(() => requireStampContent(empty), /nothing to stamp/u);
    assert.equal(contentProblem(settings), null);
    assert.equal(requireStampContent(settings), settings);
});

test("selection text distinguishes selected files from folder discovery", () => {
    assert.equal(selectionSummary(), "Choose what to stamp and how it should look.");
    assert.equal(selectionSummary({ count: 1 }), "You have selected 1 image.");
    assert.equal(selectionSummary({ count: 2 }), "You have selected 2 images.");
    assert.equal(selectionSummary({ count: 2, selectedFolders: 1 }),
        "Found 2 images in your selection, including subfolders.");
    assert.match(invitation(2, 1), /^Found 2 images/u);
});

test("validation retains the selection, copy rules and metadata warning", () => {
    const shown = formSpec(defaultAnswers(FONTS), [{ key: "size", message: "Fix the size." }], {
        count: 3, selectedFolders: 1, fonts: FONTS
    });

    assert.match(shown.detail, /^Fix the size\./u);
    assert.match(shown.detail, /Found 3 images/u);
    assert.match(shown.detail, /The original files are not changed/u);
    assert.match(shown.detail, /Leaving GPS coordinates off does not remove location data/u);
    assert.equal(shown.rows.find((row) => row.key === "customText").label, "Custom text (optional):");
    const coordinate = shown.rows.find((row) => row.key === "coordinateFormat");

    assert.deepEqual(coordinate.optional, {
        label: "Include GPS coordinates", offValue: "none",
        help: "Adds the place to the stamp. Leaving it off does not remove " +
            "location data already in the image.",
        offLabel: "Do not stamp the coordinates"
    });
});
