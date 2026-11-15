"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { catalog } = require("../../../src/host/typefaces.js");
function localizedNamed(bridge, families, name) {
    bridge.ns.NSFontManager.sharedFontManager.availableFontFamilies = { js: families.map((value) => ({ js: value })) };
    return catalog(bridge).localizedNamed(name);
}
function fixture(options = {}) {
    const queried = [];
    const memberQueries = [];
    const ns = (value) => ({ boxed: value });
    const nil = { isNil: () => true };
    const descriptors = options.descriptors ?? [{ family: "Hiragino Sans", name: "HiraginoSans-W3" }];
    Object.assign(ns, {
        NSFontVisibleNameAttribute: "visible", NSFontNameAttribute: "name", NSFontFamilyAttribute: "family",
        NSDictionary: { dictionaryWithObjectForKey: (value, key) => ({ [key]: value.boxed }) },
        NSSet: { setWithObject: (value) => [value] },
        NSFontDescriptor: { fontDescriptorWithFontAttributes: (attributes) => ({
            matchingFontDescriptorsWithMandatoryKeys(keys) {
                queried.push({ attributes, keys });
                return options.nil ? nil : { isNil: () => false, js: (keys[0] === "family" ? options.familyDescriptors ?? [] : descriptors).map((row) => ({ objectForKey: (key) => ({ boxed: row[key] }) })) };
            }
        }) },
        NSFontManager: { sharedFontManager: { availableMembersOfFontFamily(value) {
            memberQueries.push(value.boxed);
            return { js: (options.rows ?? [["HiraginoSans-W3", "W3"]]).map((row) => ({ js: row.map((member) => ({ boxed: member })) })) };
        } } },
        NSFont: { fontWithNameSize: () => { throw new Error("alias lookup must not construct a fallback font"); } }
    });
    return { bridge: { ns, objc: { unwrap: (value) => value.boxed } }, queried, memberQueries };
}

test("a localized visible name returns the canonical family and registered face", () => {
    const sample = fixture();
    const result = localizedNamed(sample.bridge, ["Hiragino Sans"], " ヒラギノ角ゴシック w3 ");
    assert.equal(result.family, "Hiragino Sans"); assert.equal(result.face, "W3");
    assert.equal(sample.queried.length, 1);
    assert.equal(sample.queried[0].attributes.visible, "ヒラギノ角ゴシック w3");
    assert.equal(sample.queried[0].keys.length, 1); assert.equal(sample.queried[0].keys[0], "visible");
    assert.deepEqual(sample.memberQueries, ["Hiragino Sans"]);
});

test("nil and no visible-name matches refuse instead of inventing a font", () => {
    for (const options of [{ nil: true }, { descriptors: [] }]) {
        const sample = fixture(options);
        assert.equal(localizedNamed(sample.bridge, ["Hiragino Sans"], "NoSuchFont"), null);
        assert.deepEqual(sample.memberQueries, []);
    }
});

test("PostScript spelling is refused even if a native matcher returns it", () => {
    const sample = fixture({ descriptors: [{ family: "Georgia", name: "Georgia-Bold" }] });
    assert.equal(localizedNamed(sample.bridge, ["Georgia"], " Georgia-Bold "), null);
    assert.deepEqual(sample.memberQueries, []);
});

test("hidden or noncatalog families cannot become configured renderer families", () => {
    const sample = fixture({ descriptors: [{ family: ".SF NS", name: ".SFNS-Regular" }] });
    assert.equal(localizedNamed(sample.bridge, ["Hiragino Sans"], "localized hidden face"), null);
    assert.deepEqual(sample.memberQueries, []);
});

test("the selected PostScript face must belong to the canonical catalog family", () => {
    const sample = fixture({ rows: [["HiraginoSans-W6", "W6"]] });
    assert.equal(localizedNamed(sample.bridge, ["Hiragino Sans"], "ヒラギノ角ゴシック W3"), null);
});

test("ambiguous native matches are refused instead of selecting the first", () => {
    const sample = fixture({ descriptors: [{ family: "Hiragino Sans", name: "HiraginoSans-W3" }, { family: "Hiragino Sans", name: "HiraginoSans-W6" }] });
    assert.equal(localizedNamed(sample.bridge, ["Hiragino Sans"], "ambiguous alias"), null);
    assert.deepEqual(sample.memberQueries, []);
});

test("blank strings never enter native matching", () => {
    const sample = fixture();
    assert.equal(localizedNamed(sample.bridge, ["Hiragino Sans"], "  "), null);
    assert.deepEqual(sample.queried, []);
});


test("a localized bare family maps uniquely to the canonical family default", () => {
    const sample = fixture({ descriptors: [], familyDescriptors: [{ family: "Hiragino Sans", name: "HiraginoSans-W0" }, { family: "Hiragino Sans", name: "HiraginoSans-W3" }] });
    const result = localizedNamed(sample.bridge, ["Hiragino Sans"], " ヒラギノ角ゴシック ");
    assert.equal(result.family, "Hiragino Sans"); assert.equal(result.face, "");
    assert.equal(sample.queried.length, 2); assert.equal(sample.queried[0].keys[0], "visible"); assert.equal(sample.queried[1].keys[0], "family");
    assert.deepEqual(sample.memberQueries, []);
});

test("a family alias cannot select between canonical families or hidden families", () => {
    for (const familyDescriptors of [
        [{ family: "Hiragino Sans", name: "HiraginoSans-W3" }, { family: "Other", name: "Other-Regular" }],
        [{ family: ".SF NS", name: ".SFNS-Regular" }]
    ]) {
        const sample = fixture({ descriptors: [], familyDescriptors });
        assert.equal(localizedNamed(sample.bridge, ["Hiragino Sans", "Other"], "ambiguous family"), null);
    }
});

test("a family matcher cannot bypass the PostScript-name restriction", () => {
    const sample = fixture({ descriptors: [], familyDescriptors: [{ family: "Georgia", name: "Georgia-Bold" }] });
    assert.equal(localizedNamed(sample.bridge, ["Georgia"], "Georgia-Bold"), null);
});
