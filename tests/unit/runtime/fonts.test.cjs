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
const {
    availableFonts,
    CANDIDATES,
    IMPOSSIBLE
} = require("../../../src/runtime/fonts.js");
const { createFakeHost } = require("./fake-host.cjs");

const WORKSPACE = "/var/folders/xx/T/StampImages.Fake01";

function machine(settings = {}) {
    const app = createFakeHost(settings);

    return {
        app,
        where: {
            app,
            tools: { vips: "/opt/homebrew/bin/vips" },
            workspace: WORKSPACE
        }
    };
}

test("a machine that draws everything offers every family in both weights", () => {
    const { where } = machine();
    const found = availableFonts(where);

    assert.deepEqual(found, CANDIDATES.flatMap(
        (family) => [family, `${family} Bold`]
    ));
    assert.equal(found.length, CANDIDATES.length * 2);
});

test("a family that draws as the fallback is not offered", () => {
    // Measured on this Mac with the fonts installed and listed by fontconfig:
    // "Helvetica" and "Times New Roman" both draw as the fallback.
    const { where } = machine({ fonts: ["Helvetica Neue", "Menlo"] });
    const found = availableFonts(where);

    assert.deepEqual(found, [
        "Helvetica Neue",
        "Helvetica Neue Bold",
        "Menlo",
        "Menlo Bold"
    ]);
});

test("a family that cannot be drawn at all is not offered either", () => {
    const { where } = machine({
        fonts: ["Menlo"],
        failures: [["Helvetica Neue", new Error("vips: broken pipe")]]
    });

    assert.deepEqual(availableFonts(where), ["Menlo", "Menlo Bold"]);
});

test("a machine none of them draws on says so", () => {
    const { where } = machine({ fonts: [] });

    assert.throws(
        () => availableFonts(where),
        (error) => {
            assert.equal(
                error.message,
                "None of the fonts this action offers draws on this Mac."
            );

            return true;
        }
    );
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
    // One vips render per candidate, and it is the longest thing a run does
    // before it says anything -- so it is where somebody waiting is most
    // likely to ask it to stop. Swallowed, that answered "this Mac does not
    // have this font" about every remaining one, and the person was told
    // their Mac had none at all.
    const stopped = new Error("User cancelled.");

    stopped.errorNumber = -128;

    const { where } = machine({
        fonts: ["Menlo"],
        failures: [["Helvetica Neue", stopped]]
    });

    // Wrapped by the layer that caught it, and still a cancellation: what
    // comes out is not a font's verdict and not a failure of the run.
    assert.throws(() => availableFonts(where), (error) => isUserCancelled(error));
});
