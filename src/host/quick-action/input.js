"use strict";
const { normalizeInvocationInput } = require("../invocation-syntax.js");
function finderSelection() { return Application("Finder").selection(); }
function isParametersRecord(item) {
    try { return item !== null && typeof item === "object" && String(item) === "[object Object]"; }
    catch { return false; }
}
function collectInvocation(app, input) {
    const items = normalizeInvocationInput(input).filter((item) => !isParametersRecord(item));
    return { inputItems: items.length > 0 ? items : finderSelection() };
}
module.exports = { finderSelection, collectInvocation };
