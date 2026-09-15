"use strict";

/*
 * Which face a run will draw with.
 *
 * The form's list is the probe's own output, so a typeface chosen from it has
 * been drawn with already. A name that did not come from it has not, and pango
 * answers every name -- so the one path that reaches a typeface without a
 * probe is the one this covers.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { assemble } = require("../../../src/runtime/assembly.js");
const { defaultSettings } = require("../../../src/core/form-defaults.js");
const { createFakeHost } = require("./fake-host.cjs");
const { recorder, prepared, place } = require("./fake-assembly.cjs");

function headlessWith(host, font, progress) {
    const invocation = {
        headless: true,
        settings: { ...defaultSettings([font]), customText: "Riga" }
    };

    return assemble({ ...prepared(host, true), invocation }, place(progress));
}

test("a headless run asks about the one face it was told to use", () => {
    // Not the ten the form offers: a configuration names its own, and asking
    // the machine about nine nobody asked for would be nine renders spent on
    // a list nothing will read.
    const host = createFakeHost({ fonts: ["Menlo"] });
    const progress = recorder();

    headlessWith(host, "Menlo", progress);

    const drawn = host.commands.filter((command) => command.includes("'text'"));

    assert.deepEqual(progress.said, ["pause"], "and says nothing while it does");
    assert.equal(drawn.length, 2, "the face and the name that cannot resolve");
    assert.ok(drawn.some((command) => command.includes("'Menlo 40'")));
});

test("a headless configuration naming a face this Mac has not is refused", () => {
    // pango answers every name: asked for one it cannot place it draws in a
    // default face and says nothing, so this used to stamp the photograph in
    // a face nobody asked for and report a complete success.
    const host = createFakeHost({ fonts: ["Menlo"] });

    assert.throws(
        () => headlessWith(host, "Zapfino", recorder()),
        /Nothing draws with the typeface "Zapfino" on this Mac/u
    );
});

test("a face chosen from the form's own list is not asked about twice", () => {
    // The list is the probe's own output, so it has been drawn with already.
    const host = createFakeHost({ fonts: ["Menlo"] });
    const progress = recorder();

    assemble(prepared(host), place(progress));

    const probes = host.commands.filter((command) => command.includes("'text'"));
    const after = host.commands
        .slice(host.commands.lastIndexOf(probes.at(-1)) + 1)
        .filter((command) => command.includes("'text'"));

    assert.deepEqual(after, [], "nothing is drawn after the list is settled");
});
