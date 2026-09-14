"use strict";

/*
 * How a font is probed, rather than which ones come back.
 *
 * Each family is drawn with, beside a name that certainly does not exist, and
 * the two drawings are compared byte for byte. Comparing their widths was the
 * first attempt and it was wrong twice over: measured on this Mac, Georgia and
 * the unresolvable name both drew the probe 192 pixels wide, and a bold name
 * that had fallen back drew 197 against the regular fallback's 192.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    availableFonts,
    CANDIDATES,
    IMPOSSIBLE
} = require("../../../src/runtime/fonts.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");

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

function fontsDrawn(app) {
    return app.commands
        .map((command) => (/'--font' '(?<font>[^']+) \d+'/u).exec(command))
        .filter(Boolean)
        .map((match) => match.groups.font);
}

test("the impossible name is drawn once, and every family against it", () => {
    const { app, where } = machine();

    availableFonts(where);

    const drawn = fontsDrawn(app);

    assert.equal(drawn.filter((font) => font === IMPOSSIBLE).length, 1);
    assert.deepEqual(drawn.slice(1), CANDIDATES);
    assert.equal(
        drawn.filter((font) => font.endsWith(" Bold")).length,
        0,
        "the weight is not probed: once the name resolves, bold is within it"
    );
});

test("the two drawings are compared byte for byte, quietly", () => {
    // Comparing their widths was the first attempt and it was wrong twice
    // over: two different faces can draw the same width, and a bold that fell
    // back draws wider than the regular it was compared against.
    const { app, where } = machine();

    availableFonts(where);

    const compared = app.commands.filter((command) => command.includes("/cmp'"));

    assert.equal(compared.length, CANDIDATES.length);
    assert.equal(
        compared[0],
        `'/usr/bin/cmp' '-s' '${WORKSPACE}/font-candidate.png' ` +
            `'${WORKSPACE}/font-fallback.png'`
    );
});

test("the probe draws letters with ascenders, descenders and digits", () => {
    // A probe of one narrow glyph is a probe two faces can pass identically.
    const { app, where } = machine();

    availableFonts(where);
    assert.ok(app.commands[0].includes("'AWgy0123'"), app.commands[0]);
    assert.ok(app.commands[0].includes(`'${IMPOSSIBLE} 40'`), app.commands[0]);
});

test("the drawings go in the workspace, not beside anybody's photographs", () => {
    const { app, where } = machine();

    availableFonts(where);

    const written = app.commands
        .filter((command) => command.includes("'text'"))
        .map((command) => command.split("' '")[2]);

    assert.ok(written.every((path) => path.startsWith(`${WORKSPACE}/`)), written[0]);
});
