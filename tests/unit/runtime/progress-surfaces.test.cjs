"use strict";

/*
 * Reports go to every surface, and a surface that refuses does not stop the
 * others: they are presented by different hosts, not by one host twice.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProgress, SILENT } = require("../../../src/runtime/progress.js");

function recorder(name, said) {
    return {
        stopped: () => false,
        start: (total) => said.push(`${name} start ${total}`),
        report: (done) => said.push(`${name} report ${done}`),
        pause: () => said.push(`${name} pause`),
        close: () => said.push(`${name} close`)
    };
}

function cancellation() {
    const error = new Error("User cancelled.");

    error.errorNumber = -128;

    return error;
}

test("every surface gets every report", () => {
    const said = [];
    const progress = createProgress([recorder("a", said), recorder("b", said)]);

    progress.expect(2);
    progress.phase("Working");

    assert.deepEqual(said, ["a start 2", "b start 2", "a report 0", "b report 0"]);
});

test("a surface that throws does not stop the one beside it", () => {
    // "I could not show this" is not news.
    const said = [];
    const broken = {
        stopped() {
            return false;
        },
        start() {
            throw new Error("no window server");
        },
        report() {
            throw new Error("no window server");
        },
        pause() {
            return undefined;
        },
        close() {
            return undefined;
        }
    };
    const progress = createProgress([broken, recorder("b", said)]);

    progress.expect(1);
    progress.phase("Working");

    assert.deepEqual(said, ["b start 1", "b report 0"]);
    assert.equal(progress.stopped(), false);
});

test("a surface can report that the person asked to stop", () => {
    // Which is not about the display -- that is merely where it arrived --
    // and it used to be discarded along with everything else thrown there.
    const progress = createProgress([{
        stopped() {
            return false;
        },
        start() {
            return undefined;
        },
        report() {
            throw cancellation();
        },
        pause() {
            return undefined;
        },
        close() {
            return undefined;
        }
    }]);

    assert.equal(progress.stopped(), false);

    // The report that discovers it is the one being made, so that report is
    // where the run stops: checking before saying anything would miss it.
    assert.throws(() => progress.phase("Working"), /User cancelled/u);
    assert.equal(progress.stopped(), true);
});

test("closing twice closes once", () => {
    // A run closes the report before it displays anything, and again in the
    // outer guarantee that it was closed at all.
    const said = [];
    const progress = createProgress([recorder("a", said)]);

    progress.close();
    progress.close();

    assert.deepEqual(said, ["a close"]);
});

test("pausing reaches every surface", () => {
    const said = [];
    const progress = createProgress([recorder("a", said), recorder("b", said)]);

    progress.pause();
    assert.deepEqual(said, ["a pause", "b pause"]);
});

test("no surface at all is silence, not a report into nothing", () => {
    assert.equal(createProgress([]), SILENT);
});

test("silence answers everything asked of it, and never stops the run", () => {
    assert.equal(SILENT.stopped(), false);

    for (const say of ["expect", "beginning", "phase", "finished", "pause", "close"]) {
        assert.equal(SILENT[say]("anything"), undefined, say);
    }
});

test("a surface that is asked can say the person wants to stop", () => {
    // The panel reads the modifier keys, which is a question rather than an
    // event: there is nothing here to deliver a button's click to.
    let held = false;
    const surface = {
        stopped: () => held,
        start: () => undefined,
        report: () => undefined,
        pause: () => undefined,
        close: () => undefined
    };
    const progress = createProgress([surface]);

    assert.equal(progress.stopped(), false);
    held = true;
    assert.equal(progress.stopped(), true);
});
