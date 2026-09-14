"use strict";

/*
 * The install command and what the integration suite actually needs.
 *
 * `tiffcp` was required by the suite while being named by no install line:
 * it worked only because vips happens to depend on libtiff, so the documented
 * install was one upstream change away from failing on a machine that
 * followed it exactly. The command is also written out four times, with
 * nothing to stop the copies drifting.
 */

const assert = require("node:assert/strict");
const test = require("node:test");

const load = () => import("../../../tools/lint/toolchain.mjs");

const INSTALLED = ["exiftool", "vips"];

test("a command is mapped to the formula that provides it", async () => {
    const { formulaFor } = await load();

    assert.equal(formulaFor("vipsheader"), "vips");
});

test("a command that ships with macOS needs no formula", async () => {
    const { formulaFor } = await load();

    assert.equal(formulaFor("osascript"), "");
});

test("a command nobody has mapped is refused, not assumed", async () => {
    // Silently treating an unknown tool as preinstalled is how tiffcp went
    // unnoticed in the first place.
    const { formulaFor } = await load();

    assert.throws(
        () => formulaFor("ghostscript"),
        /nothing records which formula provides it/u
    );
});

test("a required tool whose formula is absent is reported", async () => {
    const { missingFormulae } = await load();

    assert.deepEqual(
        missingFormulae(["vips"], ["vips", "exiftool"]),
        ["exiftool"]
    );
    assert.deepEqual(
        missingFormulae(INSTALLED, ["osascript", "vips", "vipsheader", "exiftool"]),
        [],
        "and osascript needs no formula, because macOS brings it"
    );
});

test("two commands from one formula need it named only once", async () => {
    const { missingFormulae } = await load();

    assert.deepEqual(
        missingFormulae(["vips"], ["vips", "vipsheader"]),
        []
    );
    assert.deepEqual(
        missingFormulae([], ["vips", "vipsheader"]),
        ["vips", "vips"]
    );
});
