"use strict";

const {
    STOCK,
    catalogOf,
    catalogFor
} = require("../core/fake-typefaces.cjs");

/*
 * The font system across the bridge, as JXA hands it over: a list of boxed
 * strings for the families, and for each family a list of rows describing a
 * face four ways, of which the second is the style.
 *
 * The catalog itself is the core fake's, because the catalog is a core
 * idea -- what a name resolves to is decided without a bridge. This is only
 * the shape the answer arrives in.
 */

function boxed(value) {
    return { js: value };
}

function faceRow(face) {
    return boxed([boxed("PostScriptName"), boxed(face), boxed(5), boxed(0)]);
}

function fontManager(families = STOCK) {
    return {
        sharedFontManager: {
            availableFontFamilies: boxed(Object.keys(families).map(boxed)),
            availableMembersOfFontFamily: (name) => boxed(
                (families[name.boxed] ?? []).map(faceRow)
            )
        }
    };
}

module.exports = { STOCK, catalogOf, catalogFor, fontManager };
