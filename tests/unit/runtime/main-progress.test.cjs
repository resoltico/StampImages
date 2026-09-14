"use strict";

/*
 * What a run says while it is happening, and when it stops saying it.
 *
 * The report exists before the tools are checked, because a selection of
 * folders is walked before anything is asked -- and it is closed before
 * anything is displayed, because a panel at the floating window level sits
 * above a dialog.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute, run } = require("../../../src/runtime/main.js");
const { machineWith, headlessArguments } = require("./fake-run.cjs");

function recorder(host) {
    const said = [];
    const progress = {
        said,
        stopped: () => false,
        expect: (images) => said.push(`expect ${images}`),
        beginning: (index, name) => said.push(`beginning ${index} ${name}`),
        phase: (text) => said.push(text),
        finished: (text) => said.push(`finished ${text}`),
        pause: () => said.push("pause"),
        close: () => {
            said.push("close");
            progress.dialogsAtClose = host.dialogs.length;
        }
    };

    return progress;
}

test("the stages are named as they are reached, in order", () => {
    const photographs = ["/a/one.jpg"];
    const host = machineWith(photographs);
    const progress = recorder(host);

    execute(host, headlessArguments(photographs), true, progress);

    assert.deepEqual(progress.said.slice(0, 4), [
        "Checking required tools",
        "Finding photographs",
        "pause",
        "expect 1"
    ]);
});

test("the count is the whole selection, including what could not be used", () => {
    const photographs = ["/a/one.jpg", "/a/notes.txt"];
    const host = machineWith(photographs);
    const written = [];

    assert.throws(() => execute(
        host,
        headlessArguments(photographs),
        true,
        recorder(host)
    ), (error) => {
        written.push(error.message);

        return true;
    });

    assert.match(written[0], /1 of 2 stamped/u);
});

test("the report is closed before the completion message is displayed", () => {
    // A report still on screen when the message arrives is a report in front
    // of the answer.
    const photographs = ["/a/one.jpg"];
    const host = machineWith(photographs);
    const progress = recorder(host);

    execute(host, ["/a/one.jpg"], false, progress);

    assert.equal(
        host.dialogs.length,
        progress.dialogsAtClose + 1,
        "the completion message is the one dialog the report did not precede"
    );
    assert.match(host.dialogs.at(-1).message, /1 photograph stamped\./u);
});

test("a run with nothing to stamp closes the report before saying so", () => {
    const host = machineWith(["/a/notes.txt"]);
    const progress = recorder(host);

    execute(host, ["/a/notes.txt"], false, progress);

    assert.equal(progress.dialogsAtClose, 0);
    assert.equal(host.dialogs.length, 1);
});

test("a run that fails on the way closes the report anyway", () => {
    // Whatever happens in there, the report is closed before the error dialog
    // the run returns into.
    const host = machineWith(["/a/one.jpg"], { executables: [] });
    const closed = [];

    globalThis.Application = { currentApplication: () => host };
    globalThis.Progress = {
        totalUnitCount: 0,
        completedUnitCount: 0,
        description: "",
        additionalDescription: ""
    };

    try {
        assert.equal(run(["/a/one.jpg"], {}), undefined);
        closed.push(globalThis.Progress.totalUnitCount);
    } finally {
        globalThis.Progress = undefined;
    }

    assert.deepEqual(closed, [0], "the host's bar is emptied rather than left");
    assert.match(host.dialogs.at(-1).message, /Setup needed/u);
});

test("a cancelled run says nothing at all", () => {
    // The person said no. A dialog telling them so is the program arguing.
    const host = machineWith(["/a/one.jpg"]);

    host.chooseFromList = () => false;
    globalThis.Application = { currentApplication: () => host };

    assert.equal(run(["/a/one.jpg"], {}), undefined);
    assert.deepEqual(host.dialogs, []);
});
