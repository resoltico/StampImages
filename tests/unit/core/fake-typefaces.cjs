"use strict";

/*
 * What a Mac has, as the font catalog the resolver reads: families, and the
 * faces each of them comes in.
 *
 * Two shapes, because the tests ask two kinds of question. A map of families
 * to faces is a machine whose families have styles, which is what the resolver
 * and the suggestions need. A list of names is a machine that has exactly
 * those and nothing else, which is what the front ends need to be asked about.
 */

const STOCK = {
    "Helvetica Neue": ["Regular", "Italic", "Bold", "Bold Italic"],
    Menlo: ["Regular", "Italic", "Bold", "Bold Italic"],
    Georgia: ["Regular", "Italic", "Bold", "Bold Italic"],
    Avenir: ["Book", "Light", "Medium", "Heavy", "Black"]
};

function catalogOf(families = STOCK) {
    return {
        families: Object.keys(families),
        facesOf: (family) => families[family] ?? []
    };
}

function catalogFor(names) {
    return { families: [...names], facesOf: () => [] };
}

module.exports = { STOCK, catalogOf, catalogFor };
