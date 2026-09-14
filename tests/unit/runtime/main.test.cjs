"use strict";

/*
 * The order of a run, which is the product.
 *
 * Nothing is asked of anybody until what can be checked cheaply has been, and
 * nothing is written until what will be written is known. The order is what
 * these tests are about; what each stage does is tested where it lives.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { execute } = require("../../../src/runtime/main.js");
const { machineWith, headlessArguments } = require("./fake-run.cjs");

function ran(photographs, overrides) {
    const host = machineWith(photographs, overrides);

    return {
        host,
        result: JSON.parse(execute(host, headlessArguments(photographs), true))
    };
}

test("a headless run stamps what it was given and says what it did", () => {
    const { host, result } = ran(["/a/one.jpg", "/a/two.png"]);

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg", "/a/two_stamped.png"]);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.rejected, []);
    assert.equal(result.requested, 2);
    assert.ok(host.files.has("/a/one_stamped.jpg"));
    assert.equal(host.dialogs.length, 0, "a headless run asks nothing");
});

test("the original is never opened for writing", () => {
    const { host } = ran(["/a/one.jpg"]);
    const touched = host.commands.filter(
        (command) => (/'\/bin\/(?:mv|rm|cp)' [^\n]*'\/a\/one\.jpg'/u).test(command)
    );

    assert.deepEqual(touched, []);
    assert.ok(host.files.has("/a/one.jpg"), "and it is still there");
});

test("the copy is the kind of file the photograph was", () => {
    const { result } = ran(["/a/one.heic", "/a/two.TIFF"]);

    // Written in one spelling whatever the photograph's was, because the
    // extension chooses the encoder as well as the name.
    assert.deepEqual(result.outputs, ["/a/one_stamped.heic", "/a/two_stamped.tiff"]);
    assert.deepEqual(result.failures, []);
});

test("what cannot be used is named, with the reason", () => {
    // A file that was asked for and not used is part of the outcome, not
    // something to leave out of it.
    const photographs = ["/a/one.jpg", "/a/notes.txt"];
    const host = machineWith(photographs);

    assert.throws(
        () => execute(host, headlessArguments(photographs), true),
        /not completely honoured/u
    );
});

test("a run that could not honour everything still says what it did", () => {
    // The receipt goes out on its own before the failure is raised, because
    // osascript carries one or the other and a caller needs both.
    const photographs = ["/a/one.jpg", "/a/notes.txt"];
    const host = machineWith(photographs);
    const written = [];

    globalThis.ObjC = null;
    globalThis.$ = null;

    try {
        execute(host, headlessArguments(photographs), true);
    } catch {
        written.push("failed");
    }

    assert.deepEqual(written, ["failed"]);
    assert.ok(host.files.has("/a/one_stamped.jpg"), "what worked was still done");
});

test("a selection with nothing usable says what would have been", () => {
    const photographs = ["/a/notes.txt"];

    assert.throws(
        () => execute(machineWith(photographs), headlessArguments(photographs), true),
        (error) => {
            assert.match(error.message, /Nothing to stamp/u);
            assert.match(error.message, /notes\.txt: /u);

            return true;
        }
    );
});

test("the tools are checked before the selection is even read", () => {
    // Ten answered questions and then "vips is not installed" is the whole
    // reason this order exists.
    const photographs = ["/a/one.jpg"];
    const host = machineWith(photographs, { executables: [] });

    assert.throws(
        () => execute(host, headlessArguments(photographs), true),
        /Setup needed/u
    );
    assert.deepEqual(
        host.commands.filter((command) => command.includes("'-d' '-t'")),
        [],
        "no workspace was made for a run that cannot start"
    );
});

test("a request that would stamp nothing is refused before any work", () => {
    const photographs = ["/a/one.jpg"];
    const host = machineWith(photographs, {
        settings: { dateFormat: "none", coordinateFormat: "none", customText: "" }
    });

    assert.throws(
        () => execute(host, headlessArguments(photographs), true),
        /would stamp nothing/u
    );
    assert.equal(host.files.has("/a/one_stamped.jpg"), false);
});
