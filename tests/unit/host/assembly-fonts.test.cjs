"use strict";

/*
 * Which face a run will draw with.
 *
 * pango answers every name: asked for one this Mac has not, it draws in a
 * default face and says nothing. So a name is resolved against the machine's
 * own catalog before anything is drawn, and that happens on every path --
 * the headless one included, which is the one that used to go through a
 * different door.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { assemble } = require("../../../src/host/assembly.js");
const { defaultSettings } = require("../../../src/host/form-defaults.js");
const { createFakeHost } = require("./fake-host.cjs");
const { recorder, prepared, place } = require("./fake-assembly.cjs");
const { catalogOf } = require("./fake-typefaces.cjs");

const KNOWN = catalogOf({ Menlo: ["Regular", "Italic", "Bold"] });

function headlessWith(host, font, progress) {
    const invocation = {
        headless: true,
        settings: { ...defaultSettings([font]), customText: "Riga" }
    };

    return assemble(
        { ...prepared(host, true), invocation },
        place(progress),
        KNOWN
    );
}

test("a headless run resolves the one face it was told to use", () => {
    const host = createFakeHost();
    const progress = recorder();
    const job = headlessWith(host, "Menlo Bold", progress);

    assert.deepEqual(job.settings.typeface, { family: "Menlo", face: "Bold" });
    assert.deepEqual(progress.said, ["pause"], "and says nothing while it does");
});

test("a headless configuration naming a face this Mac has not is refused", () => {
    // pango answers every name: asked for one it cannot place it draws in a
    // default face and says nothing, so this used to stamp the photograph in
    // a face nobody asked for and report a complete success.
    assert.throws(
        () => headlessWith(createFakeHost(), "Zapfino", recorder()),
        /This Mac has no typeface called "Zapfino"/u
    );
});

test("a configuration asking for a style the family has not is told which", () => {
    // Which is a sentence only a real catalog can write, and the reason for
    // reading one: the old refusal could say the name failed and nothing else.
    assert.throws(
        () => headlessWith(createFakeHost(), "Menlo Heavy", recorder()),
        /Menlo has no style called "Heavy".*Regular, Italic and Bold/su
    );
});

test("nothing is drawn to find out what this Mac has", () => {
    // It used to be the longest thing a run did before it said anything: ten
    // candidates and an impossible name, drawn and compared, every run. The
    // font system answers in one call.
    const host = createFakeHost();

    assemble(prepared(host), place(recorder()), KNOWN);

    assert.deepEqual(
        host.commands.filter((command) => command.includes("'text'")),
        []
    );
});

function watching(asked) {
    return {
        families: KNOWN.families,
        facesOf(family) {
            asked.push(family);

            return KNOWN.facesOf(family);
        }
    };
}

test("the suggestions are asked of the catalog, candidate by candidate", () => {
    const asked = [];

    assemble(prepared(createFakeHost()), place(recorder()), watching(asked));
    assert.deepEqual(asked, ["Menlo"], "the one candidate this Mac has");
});

test("a headless run is offered nothing, because nobody is there", () => {
    // Building a list would be work for a reader that does not exist, and the
    // name a configuration file gives is resolved whether there is a list or
    // not.
    const asked = [];
    const invocation = {
        headless: true,
        settings: { ...defaultSettings(["Menlo"]), customText: "Riga" }
    };
    const job = assemble(
        { ...prepared(createFakeHost(), true), invocation },
        place(recorder()),
        watching(asked)
    );

    assert.deepEqual(asked, [], "no candidate's faces were looked up");
    assert.deepEqual(job.settings.typeface, { family: "Menlo", face: "" });
});

test("an unavailable font catalog fails setup before any questions or rendering", () => {
    const host = createFakeHost();
    assert.throws(() => assemble(prepared(host), place(recorder()), null), /could not be verified/u);
    assert.deepEqual(host.dialogs, []); assert.deepEqual(host.commands, []);
});
