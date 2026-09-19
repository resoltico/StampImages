"use strict";

/*
 * Everything that can be checked before the user is asked anything.
 *
 * A machine missing a tool should say so immediately rather than after the
 * settings have been answered, and it should say everything that is wrong in
 * one message rather than one thing per attempt.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { checkTools } = require("../../../src/runtime/preflight.js");
const { createFakeApp } = require("./fake-app.cjs");

const ALL_TOOLS = [
    "/opt/homebrew/bin/vips",
    "/opt/homebrew/bin/vipsheader",
    "/opt/homebrew/bin/exiftool"
];

function machineWith(installed, settings = {}) {
    return Object.assign(createFakeApp(), { installed, ...settings });
}

test("a healthy machine yields the located tools", () => {
    assert.deepEqual(checkTools(machineWith(ALL_TOOLS)), {
        vips: "/opt/homebrew/bin/vips",
        vipsheader: "/opt/homebrew/bin/vipsheader",
        exiftool: "/opt/homebrew/bin/exiftool"
    });
});

test("the checks run before anything is asked of the user", () => {
    const app = machineWith([]);

    assert.throws(() => checkTools(app), /Setup needed/u);
    assert.equal(app.dialogs.length, 0, "no dialog was shown");
    assert.equal(app.listPrompts.length, 0, "nothing was asked");
});

test("every missing tool is named in one message", () => {
    // Reporting only the first makes somebody install, retry, and find the
    // next one.
    assert.throws(() => checkTools(machineWith([])), (error) => {
        for (const tool of ["vips", "vipsheader", "exiftool"]) {
            assert.match(error.message, new RegExp(`${tool} is not installed`, "u"));
        }

        return true;
    });
});

test("one missing tool does not hide the others being fine", () => {
    const app = machineWith(ALL_TOOLS.filter((tool) => !tool.endsWith("exiftool")));

    assert.throws(() => checkTools(app), (error) => {
        assert.match(error.message, /exiftool is not installed/u);
        assert.ok(!/vips is not installed/u.test(error.message));

        return true;
    });
});

test("a vips that does not take the flags is reported, not passed", () => {
    // The case a presence check misses: installed, on PATH, and it rejects a
    // flag the pipeline uses on every single run.
    const app = machineWith(ALL_TOOLS, { vipsProbe: "Unknown option --export-profile" });

    assert.throws(() => checkTools(app), (error) => {
        assert.match(error.message, /vips is installed but does not do what this needs/u);
        // Naming the flags is the whole value of the message: it is what
        // distinguishes "upgrade vips" from "something is wrong".
        assert.match(
            error.message,
            /--size=down, --export-profile and --fail-on/u
        );

        return true;
    });
});

test("an exiftool that cannot answer in JSON is reported the same way", () => {
    // It is asked positively, about its own executable, so anything but the
    // JSON this program reads means it cannot answer the questions asked of
    // it -- including a build that printed a warning instead.
    for (const answer of ["Error: File not found", "[]", "not json", ""]) {
        const app = machineWith(ALL_TOOLS, { exiftool: answer });

        assert.throws(() => checkTools(app), (error) => {
            assert.match(error.message, /exiftool is installed but does not do/u);
            assert.match(error.message, /answer -json -n with readable JSON/u);

            return true;
        }, answer);
    }
});

test("the remedy adapts to whether Homebrew is present", () => {
    assert.throws(() => checkTools(machineWith([])), /Run this in Terminal/u);
    assert.throws(
        () => checkTools(machineWith([], { brew: "" })),
        /Install Homebrew first/u
    );
});

test("a probe that cannot run at all is treated as unusable", () => {
    // doShellScript itself failing must not crash the check: it means the
    // tool could not answer, which is not a pass.
    const app = machineWith(ALL_TOOLS);
    const inner = app.doShellScript;

    app.doShellScript = (command) => {
        if (command.includes("nonexistent-stamp-images-preflight")) {
            throw new Error("could not spawn");
        }

        return inner(command);
    };

    assert.throws(() => checkTools(app), /vips is installed but does not do/u);
});

test("a failing Homebrew check is treated as Homebrew being absent", () => {
    const app = machineWith([]);
    const inner = app.doShellScript;

    app.doShellScript = (command) => {
        if (command.includes("command -v brew")) {
            throw new Error("no shell");
        }

        return inner(command);
    };

    assert.throws(() => checkTools(app), /Install Homebrew first/u);
});
