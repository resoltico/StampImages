"use strict";
const { catalog } = require("../../src/host/typefaces.js");
const { faceOf } = require("../../src/core/typeface.js");
function run() {
    const known = catalog();
    const names = ["Hiragino Sans W3", "Hiragino Sans W6", "ヒラギノ角ゴシック W3", "ヒラギノ角ゴシック W6", "ヒラギノ角ゴシック"];
    return JSON.stringify(names.map((name) => {
        const font = $.NSFont.fontWithNameSize($(name), 36);
        return { name, resolved: faceOf(known, name), native: font && !font.isNil() ? String(ObjC.unwrap(font.fontName)) : null };
    }));
}
module.exports = { run };
