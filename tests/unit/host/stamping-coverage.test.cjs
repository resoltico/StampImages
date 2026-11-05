"use strict";

/*
 * Whether the stamp holds a character its typeface lacks.
 *
 * Field regression (2026-11-05, unreleased main): "abc" in Zapf Dingbats was
 * drawn in a plain sans and nothing said so, because pango substitutes a face
 * for any character the chosen one has no glyph for.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { substituted } = require("../../../src/host/stamping.js");
const { catalogue } = require("../../../src/host/typefaces.js");

const ASCII = (codePoint) => codePoint < 0x80;

test("a character outside the face is noticed; spacing and controls are not characters", () => {
    assert.equal(substituted({ covers: ASCII }, ["2026-09-09 14:30", "Riga"]), false);
    assert.equal(substituted({ covers: ASCII }, ["Rīga"]), true);
    assert.equal(substituted({ covers: ASCII }, ["a⁦b⁩‍ ć"]), false);
    assert.equal(substituted({ covers: null }, ["東京"]), false, "a face that cannot be asked claims nothing");
});

test("the catalogue asks the chosen face, not the family's first", () => {
    const ns = (value) => ({ boxed: value });
    const row = (postScript, face) => ({ js: [{ js: postScript }, { js: face }, { js: 5 }, { js: 0 }] });
    const asked = [];

    ns.NSFontManager = { sharedFontManager: {
        availableFontFamilies: { js: [] },
        availableMembersOfFontFamily: () => ({ js: [row("Face-Regular", "Regular"), row("Face-Bold", "Bold")] })
    } };
    ns.NSFont = { fontWithNameSize(name) {
        asked.push(name.js);

        return { isNil: () => false, coveredCharacterSet: { longCharacterIsMember: (codePoint) => codePoint === 65 } };
    } };
    const known = catalogue({ ns, objc: { import: () => true } });
    const covers = known.coverageOf({ family: "Face", face: "Bold" });

    assert.deepEqual([covers(65), covers(66)], [true, false]);
    known.coverageOf({ family: "Face", face: "" });
    assert.deepEqual(asked, ["Face-Bold", "Face-Regular"]);
    assert.equal(known.coverageOf({ family: "Face", face: "Missing" }), null);
    ns.NSFont.fontWithNameSize = () => ({ isNil: () => true });
    assert.equal(known.coverageOf({ family: "Face", face: "Bold" }), null);
});
