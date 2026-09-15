"use strict";

/*
 * What a run has gathered by the time it can be assembled: a host to ask, the
 * tools in fixed places, and somewhere to report to.
 *
 * Shared because two test files drive `assemble` -- what it puts together, and
 * which face it will draw with -- and helpers written down twice are two
 * things that must agree.
 */

const { WORKSPACE } = require("./fake-host.cjs");

const TOOLS = Object.freeze({
    vips: "/opt/homebrew/bin/vips",
    vipsheader: "/opt/homebrew/bin/vipsheader",
    exiftool: "/opt/homebrew/bin/exiftool"
});

// Records what it was told rather than showing it, and is never stopped: where
// a stop lands is job-cancelling.test.cjs.
function recorder() {
    const said = [];

    return {
        said,
        stopped: () => false,
        expect: () => undefined,
        beginning: () => undefined,
        phase: (text) => said.push(text),
        finished: () => undefined,
        pause: () => said.push("pause"),
        close: () => said.push("close")
    };
}

function prepared(host, headless = false) {
    return {
        app: host,
        tools: { ...TOOLS },
        invocation: { headless, settings: null },
        selection: { images: [{}, {}], rejected: [] }
    };
}

function place(progress, unpublished = new Set()) {
    return { workspace: WORKSPACE, unpublished, progress };
}

module.exports = { TOOLS, recorder, prepared, place };
