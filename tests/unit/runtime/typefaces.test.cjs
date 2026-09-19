"use strict";

/*
 * Reading the machine's font catalogue across the bridge.
 *
 * It is the font system the renderer draws through, which is the whole point:
 * fontconfig was asked before, and fontconfig is a different catalogue -- 671
 * families here against CoreText's 217, with neither containing the other. A
 * face switched on by a font manager is in one and not the other, which is how
 * a typeface every other app could use was refused.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { catalogue } = require("../../../src/runtime/typefaces.js");
const { fontManager, STOCK } = require("./fake-typefaces.cjs");

function bridge(families = STOCK) {
    const ns = (value) => ({ boxed: value });

    ns.NSFontManager = fontManager(families);

    return { ns, objc: { import: () => true } };
}

test("the families are the ones the font system lists", () => {
    assert.deepEqual(catalogue(bridge()).families, Object.keys(STOCK));
});

test("a family's faces are the styles the font system names", () => {
    // Avenir answers Book, Light, Medium, Heavy and Black -- none of which a
    // Regular-or-Bold menu could ever have reached.
    assert.deepEqual(
        catalogue(bridge()).facesOf("Avenir"),
        ["Book", "Light", "Medium", "Heavy", "Black"]
    );
});

test("a family nothing has answers with no faces at all", () => {
    assert.deepEqual(catalogue(bridge()).facesOf("Nothing"), []);
});

test("a font system that answers nothing at all is no faces either", () => {
    // ObjC returns nil for a family it does not know, which arrives as
    // nothing rather than as an empty list.
    const ns = (value) => ({ boxed: value });

    ns.NSFontManager = {
        sharedFontManager: {
            availableFontFamilies: { js: [] },
            availableMembersOfFontFamily: () => ({ js: undefined })
        }
    };

    assert.deepEqual(
        catalogue({ ns, objc: { import: () => true } }).facesOf("Nothing"),
        []
    );
});

test("a family is asked about once, however often it is asked for", () => {
    const asked = [];
    const ns = (value) => ({ boxed: value });

    ns.NSFontManager = {
        sharedFontManager: {
            availableFontFamilies: { js: [{ js: "Georgia" }] },
            availableMembersOfFontFamily(name) {
                asked.push(String(name.boxed));

                return { js: [{ js: [{ js: "PS" }, { js: "Regular" }] }] };
            }
        }
    };

    const known = catalogue({ ns, objc: { import: () => true } });

    known.facesOf("Georgia");
    known.facesOf("Georgia");

    assert.deepEqual(asked, ["Georgia"]);
});

test("asked for without a bridge, it finds its own", () => {
    // Which is nothing at all here: there is no ObjC bridge in a test, and
    // that is the same answer a host without AppKit gives.
    assert.equal(catalogue(), null);
});

test("a host that cannot reach AppKit has no catalogue, not an empty one", () => {
    // Nothing may read that as "this Mac has no fonts": the run still has a
    // renderer, and refusing every typeface on a machine that has them all
    // would be the worse failure.
    assert.equal(catalogue(null), null);
});
