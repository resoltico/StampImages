"use strict";
const { createProgress } = require("../progress.js");
const { noImagesOutcome } = require("../../core/outcomes.js");
const { resolveStampSettings } = require("../stamp-settings.js");
const { catalog } = require("../typefaces.js");

function commandLineInteraction(invocation, options = {}) {
    const { progress = createProgress([]), known = catalog() } = options;
    // Configuration typefaces are refused before tool discovery or source admission.
    const resolved = resolveStampSettings(invocation.settings, known);
    return { progress, collect: () => invocation, settings: () => resolved,
        noImages: noImagesOutcome, present: (result) => result };
}
module.exports = { commandLineInteraction };
