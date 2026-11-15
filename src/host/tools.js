"use strict";
const { OperationError } = require("../core/errors.js");

const { PRINTENV } = require("../core/executables.js");
const { shellQuote } = require("../core/shell.js");
const { runArgv } = require("./shell.js");
const { isUserCanceled } = require("../core/errors.js");
const { hostError } = require("./cancellation.js");
const { isExecutable } = require("./filesystem-probes.js");

/*
 * Discovery of the external command-line tools.
 *
 * Shortcuts runs with a minimal PATH, so the usual install locations are
 * probed directly before falling back to a PATH search.
 *
 * Absence is reported rather than thrown: the preflight collects every problem
 * so the user is told about all of them at once, not the first one.
 */

const TOOL_SEARCH_PATH =
    "/opt/homebrew/bin:/usr/local/bin:/opt/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

const TOOL_NAMES = ["vips", "vipsheader", "exiftool"];

const ENVIRONMENT_OVERRIDES = {
    vips: "STAMP_IMAGES_VIPS",
    vipsheader: "STAMP_IMAGES_VIPSHEADER",
    exiftool: "STAMP_IMAGES_EXIFTOOL"
};

/*
 * Read overrides once. Exit 1 means the name is unset; a provided value is
 * retained for diagnostics and must name an absolute regular executable file.
 */
function optionalEnvironment(app, name) {
    try { return { state: "provided", value: String(runArgv(app, [PRINTENV, name], "reading the requested tool override")) }; }
    catch (error) {
        if (isUserCanceled(error)) { throw error; }
        if (error.cause?.errorNumber === 1) { return { state: "absent" }; }
        throw error;
    }
}

function searchPath(app, executableName) {
    try {
        const found = String(
            app.doShellScript(
                `PATH=${shellQuote(TOOL_SEARCH_PATH)}; ` +
                `command -v ${shellQuote(executableName)}`
            )
        ).trim();

        return found && isExecutable(app, found) ? found : "";
    } catch (caught) {
        const error = hostError(caught);
        if (isUserCanceled(error) || error instanceof TypeError || error instanceof ReferenceError) { throw error; }
        return "";
    }
}

function candidatePaths(executableName) {
    return [
        `/opt/homebrew/bin/${executableName}`,
        `/usr/local/bin/${executableName}`,
        `/opt/local/bin/${executableName}`
    ];
}

/*
 * Return the located path with its override provenance, or an empty path
 * when automatic discovery finds no tool. Explicit invalid overrides refuse.
 */
function findTool(app, executableName) {
    const override = optionalEnvironment(
        app,
        ENVIRONMENT_OVERRIDES[executableName]
    );

    if (override.state === "provided") {
        const path = override.value.trim();
        const requested = { name: ENVIRONMENT_OVERRIDES[executableName], value: override.value };
        if (!path || !isExecutable(app, path)) {
            throw new OperationError(`${requested.name}=${JSON.stringify(requested.value)} is not an absolute regular executable file.`);
        }
        return { path, override: requested };
    }

    for (const candidate of candidatePaths(executableName)) {
        if (isExecutable(app, candidate)) {
            return { path: candidate, override: null };
        }
    }

    return { path: searchPath(app, executableName), override: null };
}

module.exports = { TOOL_NAMES, TOOL_SEARCH_PATH, findTool };
