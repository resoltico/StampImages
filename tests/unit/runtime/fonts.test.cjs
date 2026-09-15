"use strict";

/*
 * Which fonts this machine will actually render with.
 *
 * pango answers every name: asked for one it cannot place, it draws in a
 * default face and says nothing. So each family is drawn with before it is
 * offered, beside a name that certainly does not exist, and a family whose
 * drawing is that drawing did not resolve.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { isUserCancelled } = require("../../../src/core/errors.js");
const { availableFonts, CANDIDATES } = require("../../../src/runtime/fonts.js");
const { IMPOSSIBLE, undrawable } = require("../../../src/runtime/font-probe.js");
const { createFakeHost } = require("./fake-host.cjs");

const WORKSPACE = "/var/folders/xx/T/StampImages.Fake01";

function machine(settings = {}) {
    const app = createFakeHost(settings);

    return {
        app,
        where: {
            app,
            tools: {
                vips: "/opt/homebrew/bin/vips",
                "fc-match": "/opt/homebrew/bin/fc-match"
            },
            workspace: WORKSPACE
        }
    };
}

test("a machine that has everything is offered every family, and no weights", () => {
    // Families, because a weight is a setting of its own. The list used to
    // offer each name twice, as itself and with " Bold" on the end, which made
    // the value a font description rather than a name -- and the bold half was
    // never resolved at all, because only the plain name was ever drawn with.
    const { where } = machine();

    assert.deepEqual(availableFonts(where), CANDIDATES);
});

test("a family this Mac has not is not offered", () => {
    const { where } = machine({ fonts: ["Helvetica Neue", "Menlo"] });

    assert.deepEqual(availableFonts(where), ["Helvetica Neue", "Menlo"]);
});

test("a family fontconfig keeps but the renderer cannot draw is not offered", () => {
    // Measured: Helvetica, Times, Hoefler Text and Iowan Old Style all keep
    // their names through fontconfig and all draw as the fallback, because the
    // files macOS keeps them in are not ones freetype will open. So the name
    // has to survive both questions.
    const { where } = machine({
        fonts: ["Helvetica Neue", "Menlo"],
        failures: [["Helvetica Neue", new Error("vips: broken pipe")]]
    });

    assert.deepEqual(availableFonts(where), ["Menlo"]);
});

test("a machine none of them has is not a machine that cannot be used", () => {
    // It used to refuse the run, which was right while the list was the only
    // way to name a typeface: the field takes any family now, so a Mac with
    // none of these ten and hundreds of others would have been stopped at the
    // door for no reason.
    const { where } = machine({ fonts: [] });

    assert.deepEqual(availableFonts(where), []);
});

test("a renderer that cannot draw at all is a broken tool, not a bare Mac", () => {
    // Saying this Mac has no fonts would send somebody to Font Book over a
    // vips that cannot draw a line of text.
    const { where } = machine({
        failures: [[IMPOSSIBLE, new Error("vips: no such operation")]]
    });

    assert.throws(
        () => availableFonts(where),
        /Command failed while checking which fonts are installed/u
    );
});

test("a probe somebody stopped is not a Mac with no fonts", () => {
    // One question per candidate, and it is the longest thing a run does
    // before it says anything -- so it is where somebody waiting is most
    // likely to ask it to stop. Swallowed, that answered "this Mac does not
    // have this font" about every remaining one.
    const stopped = new Error("User cancelled.");

    stopped.errorNumber = -128;

    const { where } = machine({
        fonts: ["Helvetica Neue", "Menlo"],
        failures: [["Helvetica Neue", stopped]]
    });

    assert.throws(() => availableFonts(where), (error) => isUserCancelled(error));
});

test("a drawing that cannot be compared is not a typeface that resolved", () => {
    // Read as "these differ", a comparison that was never made made an
    // undrawable name into a usable one -- the one direction this must never
    // fail in. It stops the probe instead, and the name is refused.
    const unreadable = new Error("cmp: no such file");

    unreadable.errorNumber = 2;

    const { where } = machine({
        fonts: ["Helvetica Neue"],
        failures: [["/cmp", unreadable]]
    });

    assert.deepEqual(availableFonts(where), []);
});

test("the refusal names the likeliest reason, and advises only where it can", () => {
    // A font manager activates a face through the system's own machinery
    // without putting a file where these tools look, so every other app shows
    // it while fontconfig has never heard of it. The message used to end by
    // telling people to set the weight elsewhere, which sent somebody to try
    // both weights of a face this cannot see at all.
    const said = undrawable("Source Serif 4");

    assert.match(said, /does not draw with the typeface "Source Serif 4"/u);
    assert.match(said, /activated by a font manager rather than installed/u);
    assert.doesNotMatch(said, /weight/iu, "no advice about a different problem");
});

test("a name that carries its weight is told where the weight goes", () => {
    // Which is the one shape this can be sure about: it is what 1.0.0 stored.
    const said = undrawable("Helvetica Neue Bold");

    assert.match(said, /try "Helvetica Neue" and set Weight/u);
});
