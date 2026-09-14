"use strict";

const { MKTEMP, RM } = require("../core/executables.js");
const { runArgv, tryArgv } = require("./shell.js");

/*
 * Private temporary workspace lifecycle.
 *
 * The path is checked against the expected mktemp shape before anything is
 * removed recursively, so a surprising mktemp result can never turn into an
 * rm -rf of the wrong directory.
 *
 * No whitespace anywhere in it, which is a second requirement and a real one:
 * vips bandjoin takes its inputs as one space-separated argument, so a
 * workspace path with a space in it would be read as two paths. It is refused
 * here, where the message can say what happened, rather than several steps
 * later where it would name a file nobody asked about.
 */

const MADE_HERE = /\/StampImages\.[^/]+$/u;
const WORKSPACE_PATTERN = /^\S*\/StampImages\.[^/\s]+$/u;
const NONCE_RANGE = 1000000000;

function createWorkspace(app) {
    const path = String(
        runArgv(
            app,
            [MKTEMP, "-d", "-t", "StampImages"],
            "creating temporary workspace"
        )
    ).trim();

    if (!WORKSPACE_PATTERN.test(path)) {
        /*
         * Two different refusals. A path with the shape mktemp was asked for
         * is one this run made, so an unusable one is this run's to take away
         * again; a path of some other shape is not ours to touch, and that is
         * what the guard in front of rm -rf is for.
         */
        if (MADE_HERE.test(path)) {
            tryArgv(app, [RM, "-rf", path]);
        }

        throw new Error(
            `This Mac's temporary folder cannot be used:\n\n${path}`
        );
    }

    return path;
}

function removeWorkspace(app, path) {
    if (!path || !WORKSPACE_PATTERN.test(path)) {
        return;
    }

    // Cleanup failure must not mask the original outcome.
    tryArgv(app, [RM, "-rf", path]);
}

function nonce() {
    return `${Date.now()}-${Math.floor(Math.random() * NONCE_RANGE)}`;
}

module.exports = { createWorkspace, removeWorkspace, nonce };
