"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { pagesIn, bandsOf } = require("../../../src/runtime/fidelity.js");
const { sizeOf } = require("../../../src/runtime/tinting.js");
const { readPhotograph, prepared } = require("../../../src/runtime/preparing.js");
const { isUserCancelled } = require("../../../src/core/errors.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost({files: ["/photo.png"], ...settings});

    return {host, job: {...makeJob(host), workspace: WORKSPACE}};
}

test("invalid page counts never imply a single-image file", () => {
    for (const pages of ["", 0, -1, "2junk", "1.5", "1e2", "9007199254740992"]) {
        assert.throws(() => pagesIn(jobOn({pages}).job, "/photo.png"), /n-pages.*positive whole/u);
    }
});

test("page-count read failures are reported rather than treated as one image", () => {
    const {job} = jobOn({failures: [["'n-pages'", new Error("header read failed")]]});

    assert.throws(() => pagesIn(job, "/photo.png"), /header read failed/u);
});

test("a missing-field diagnostic inside other error text is not accepted", () => {
    for (const message of [
        'cannot read "vips_image_get: field "n-pages" not found.jpg"',
        'unreadable: vips_image_get: field "n-pages" not found',
        'vips_image_get: field "n-pages" not found: another error',
        'vips_image_get: field "width" not found'
    ]) {
        const {job} = jobOn({failures: [["'n-pages'", new Error(message)]]});

        assert.throws(() => pagesIn(job, "/photo.png"));
    }
});

test("cancellation remains a cancellation even if the message names the missing field", () => {
    const error = Object.assign(new Error('vips_image_get: field "n-pages" not found'), {errorNumber: -128});
    const {job} = jobOn({failures: [["'n-pages'", error]]});

    assert.throws(() => pagesIn(job, "/photo.png"), isUserCancelled);
});

test("invalid dimensions and band counts fail their measurement", () => {
    for (const value of ["", 0, -1, "4junk", "1.5", "Infinity", "9007199254740992"]) {
        assert.throws(() => bandsOf(jobOn({bands: value}).job, "/photo.png"), /bands.*positive whole/u);
        assert.throws(() => sizeOf(jobOn({width: value}).job, "/photo.png"), /width.*positive whole/u);
        assert.throws(() => sizeOf(jobOn({height: value}).job, "/photo.png"), /height.*positive whole/u);
    }
});

test("a rejected measurement removes the decoded intermediate immediately", () => {
    const {host, job} = jobOn({bands: "4junk"});

    assert.throws(() => readPhotograph(job, "/photo.png", "1"), /bands.*positive whole/u);
    assert.equal(host.files.has(`${WORKSPACE}/oriented-1.v`), false);
    assert.equal(host.files.has("/photo.png"), true);
});

test("a decoder failure removes a partial intermediate", () => {
    const {host, job} = jobOn();
    const run = host.doShellScript;

    host.doShellScript = (command) => {
        if (command.includes("'autorot'")) {
            host.files.add(`${WORKSPACE}/oriented-1.v`);
            throw new Error("partial decode");
        }

        return run(command);
    };
    assert.throws(() => readPhotograph(job, "/photo.png", "1"), /partial decode/u);
    assert.equal(host.files.has(`${WORKSPACE}/oriented-1.v`), false);
});

test("the reader refuses multi-image sources before decoding them", () => {
    const {host, job} = jobOn({pages: 2});

    assert.throws(() => readPhotograph(job, "/photo.png", "1"), /holds 2 images/u);
    assert.equal(host.commands.some((command) => command.includes("'autorot'")), false);
});

test("an explicit missing-field diagnostic from vipsheader remains single-image", () => {
    for (const message of [
        'vipsheader: vips_image_get: field "n-pages" not found',
        ' \nvipsheader: vips_image_get: field "n-pages" not found\n '
    ]) {
        const {job} = jobOn({failures: [["'n-pages'", new Error(message)]]});

        assert.equal(pagesIn(job, "/photo.png"), 1);
    }
});

test("grey with alpha is expanded for a colour caption and its intermediate is owned", () => {
    const {host} = jobOn({bands: 2, stored: "grey"});
    const job = {...makeJob(host, {textColour: "#FF3B30", outlineWidth: 0}), workspace: WORKSPACE};
    const intermediates = [];
    const result = prepared(job, {path: "/photo.png"}, "1", intermediates);

    assert.equal(result.expanded, true);
    assert.deepEqual(intermediates, [`${WORKSPACE}/oriented-1.v`, `${WORKSPACE}/colour-1.v`]);
});
