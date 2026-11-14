"use strict";
const { OperationError } = require("../core/errors.js");
const { validateSettings, stampIssues } = require("../core/settings.js");
const { faceOf } = require("../core/typeface.js");

/** Resolve machine-dependent drawing values without putting host capabilities in settings. */
function resolveStampSettings(input, known) {
    const validated = validateSettings(input);
    if (validated.issues.length > 0) { throw new OperationError(validated.issues.map((issue) => issue.message).join("\n"), { issues: validated.issues }); }
    if (!known) { throw new OperationError("Installed typefaces could not be verified on this Mac."); }
    const issues = stampIssues(validated.settings, known);
    if (issues.length > 0) { throw new OperationError(issues.map((issue) => issue.message).join("\n"), { issues }); }
    const typeface = faceOf(known, validated.settings.font);
    return { settings: { ...validated.settings, typeface }, covers: known.coverageOf?.(typeface) ?? null };
}
module.exports = { resolveStampSettings };
