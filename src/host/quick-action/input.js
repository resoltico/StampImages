"use strict";
const { normalizeInvocationInput } = require("../invocation-syntax.js");
function finderSelection() { return Application("Finder").selection(); }
function collectInvocation(app, input) {
    const items = normalizeInvocationInput(input);
    return { inputItems: items.length > 0 ? items : finderSelection() };
}
module.exports = { finderSelection, collectInvocation };
