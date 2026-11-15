"use strict";
const { hostError } = require("./cancellation.js");
const { OperationError, isUserCanceled } = require("../core/errors.js");
const { shellQuote } = require("../core/shell.js");
const {
    buildVipsheaderProbeArgv,
    isVipsheaderUsable,
    VIPSHEADER_PROBE_IMAGE,
    buildVipsProbeArgv,
    buildExiftoolProbeArgv,
    isVipsUsable,
    isExiftoolUsable,
    describeSetupProblems
} = require("../backend/preflight.js");
const { probeArgv, probeImageArgv } = require("./shell.js");
const { findTool, TOOL_NAMES, TOOL_SEARCH_PATH } = require("./tools.js");

/*
 * Verify backend tools before source admission. Quick-action settings follow
 * setup; command-line settings and typeface validation precede this check.
 */

/*
 * Ordinary capability probes capture failure output. The header probe also
 * requires successful execution against its privately owned built-in image.
 * Cancellation remains cancellation rather than an unusable-tool response.
 */
function probe(app, argv, image) {
    try {
        return image ? probeImageArgv(app, argv, image) : probeArgv(app, argv);
    } catch (caught) {
        const error = hostError(caught);
        if (isUserCanceled(error)) { throw error; }
        return "";
    }
}

function hasHomebrew(app) {
    try {
        return Boolean(app.doShellScript(`PATH=${shellQuote(TOOL_SEARCH_PATH)}; command -v brew 2>/dev/null || true`));
    } catch (caught) {
        const error = hostError(caught);
        if (isUserCanceled(error)) { throw error; }
        return false;
    }
}

const CAPABILITY_PROBES = {
    vipsheader: { build: buildVipsheaderProbeArgv, usable: isVipsheaderUsable, image: VIPSHEADER_PROBE_IMAGE },
    vips: {
        build: buildVipsProbeArgv,
        usable: isVipsUsable,
        flags: "--size=down, --export-profile and --fail-on"
    },
    exiftool: {
        build: buildExiftoolProbeArgv,
        usable: isExiftoolUsable,
        flags: "return a structured raw capture projection with JSONQ"
    }
};

function inspectTool(app, name) {
    const found = findTool(app, name);

    if (!found.path) {
        return { tool: name, kind: "missing", ...found };
    }

    const capability = CAPABILITY_PROBES[name];

    if (capability && !capability.usable(probe(app, capability.build(found.path), capability.image), found.path)) {
        return {
            tool: name,
            kind: "unusable",
            flags: capability.flags,
            ...found
        };
    }

    return { tool: name, kind: "ok", ...found };
}

/*
 * Returns the located tools, or throws one message describing every problem.
 */
function checkTools(app) {
    const results = TOOL_NAMES.map((name) => inspectTool(app, name));
    const problems = results.filter((result) => result.kind !== "ok");

    if (problems.length > 0) {
        // Setup refusals are operations; override diagnostics name the requested executable.
        throw new OperationError(describeSetupProblems(problems, problems.some((problem) => !problem.override) && hasHomebrew(app)));
    }

    const tools = {};

    for (const result of results) {
        tools[result.tool] = result.path;
    }

    return tools;
}

module.exports = { checkTools };
