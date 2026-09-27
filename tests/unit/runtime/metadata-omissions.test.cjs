"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { runJob } = require("../../../src/runtime/job.js");
const { factsFor } = require("../../../src/runtime/facts.js");
const { isCompleteSuccess, ledgerOf } = require("../../../src/runtime/receipt.js");
const { reportHeadless, detailOf } = require("../../../src/runtime/reporting.js");
const { execute } = require("../../../src/runtime/main.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob, imageOf } = require("./fake-job.cjs");
const { machineWith, headlessArguments } = require("./fake-run.cjs");
const PATH = "/a/photo.jpg";

test("single-file ExifTool queries require exactly one non-array object record", () => {
    for (const response of ["[true]", "[false]", "[12]", '["text"]', "[[]]", "[{},{}]"]) {
        const host = createFakeHost({ failures: [["exiftool", response]] });

        assert.throws(() => factsFor(makeJob(host), PATH), /answered with nothing about this photograph/u);
    }
});

function partialStamp() {
    const host = createFakeHost({ files: [PATH] });
    const ran = runJob(makeJob(host), [imageOf(PATH)]);

    return { host, result: { ...ran, requested: 1, rejected: [], excluded: [] } };
}

test("partial-stamp omissions survive rendering and publication without double-counting copies", () => {
    const { result } = partialStamp();

    assert.deepEqual(result.outputs, ["/a/photo_stamped.jpg"]);
    assert.deepEqual(result.missingMetadata, [{
        name: "photo.jpg", path: PATH, output: "/a/photo_stamped.jpg", fields: ["date/time", "GPS coordinates"]
    }]);
    assert.equal(isCompleteSuccess(result), false);
    assert.deepEqual(ledgerOf(result), { stamped: 1, failed: 0, nothing: 0, rejected: 0, notAttempted: 0 });
    assert.match(detailOf(result), /\n\nStamped without everything asked for:\nphoto\.jpg: no date\/time or GPS coordinates in its metadata$/u);
});

test("headless omissions produce an incomplete receipt while retaining copies and originals", () => {
    const { result, host } = partialStamp();
    const written = [];

    assert.throws(() => reportHeadless(result, (text) => written.push(text)), /1 copy missing requested metadata/u);
    assert.equal(JSON.parse(written[0]).missingMetadata[0].output, result.outputs[0]);
    assert.equal(written[0].at(-1), "\n");
    assert.ok(host.files.has(result.outputs[0]), "an incomplete request retains the copy it did create");
    assert.ok(host.files.has(PATH), "the source is unchanged");
});

test("coordinates switched off mean a successful date-only headless run with no GPS reads", () => {
    const host = machineWith([PATH], {
        settings: { coordinateFormat: "none", customText: "" },
        facts: { DateTimeOriginal: "2026:09:09 14:30:05" }
    });
    const result = JSON.parse(execute(host, headlessArguments([PATH]), true));

    assert.deepEqual(result.missingMetadata, []);
    assert.deepEqual(result.outputs, ["/a/photo_stamped.jpg"]);
    assert.ok(host.commands.some((command) => command.includes("'-DateTimeOriginal'")));
    assert.ok(!host.commands.some((command) => command.includes("'-GPSLatitude'") || command.includes("'-GPSLongitude'")));
    assert.equal(host.dialogs.length, 0);
});

test("caption-only jobs never issue a zero-tag metadata request", () => {
    const host = machineWith([PATH], { settings: { dateFormat: "none", coordinateFormat: "none", customText: "caption" } });

    execute(host, headlessArguments([PATH]), true);
    const queries = host.commands.filter((command) => command.includes("exiftool") && command.includes("'-json'"));

    assert.ok(queries.length > 0, "the executable is still positively preflighted");
    assert.ok(queries.every((command) => !command.endsWith(`'${PATH}'`)), "no stamp-metadata request for this file");
});
