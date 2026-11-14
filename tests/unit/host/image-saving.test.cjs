"use strict";

/*
 * Saving the copy.
 *
 * A copy of a photograph should be the same kind of thing it was, written at
 * a quality nobody has to accept by default, and it should be a photograph:
 * a file with something in it is not one, so the copy is asked its size
 * through the reader that will have to open it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { saveCopy } = require("../../../src/host/image.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost({ files: ["/a/one.jpg"], ...settings });

    return { host, job: { ...makeJob(host), workspace: WORKSPACE } };
}

test("a copy of a photograph is the same kind of thing it was", () => {
    // Compositing adds an alpha band whether the photograph had one or not,
    // and a JPEG has nowhere to put transparency.
    const { host, job } = jobOn();

    saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/staged-1.jpg`, {
        metadataSource: "/owned/source.jpg",
        hasAlpha: false,
        size: { width: 600, height: 400 }
    });

    assert.ok(host.commands.some((command) => command.includes("'flatten'")));
});

test("the encoder is told what to do, on the path and nowhere else", () => {
    // vips reads its settings off the path it is given; everything that asks
    // whether the file is there asks about the file.
    const { host, job } = jobOn();

    saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/staged-1.jpg`, {
        metadataSource: "/owned/source.jpg",
        hasAlpha: false,
        size: { width: 600, height: 400 }
    });

    assert.ok(host.commands.some(
        (command) => command.includes("'flatten'") && command.includes("staged-1.jpg[Q=90]")
    ));
    assert.ok(host.commands.some(
        (command) => command.startsWith("'/bin/test' '-f'") &&
            !command.includes("[Q=90]")
    ));
});

test("a photograph that had transparency keeps it", () => {
    const { host, job } = jobOn();

    saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/staged-1.png`, {
        metadataSource: "/owned/source.jpg",
        hasAlpha: true,
        size: { width: 600, height: 400 }
    });

    assert.ok(host.commands.some((command) => command.includes("'copy'")));
    assert.deepEqual(
        host.commands.filter((command) => command.includes("'flatten'")),
        []
    );
});

test("a copy that was not written is not a copy", () => {
    const { job } = jobOn({ failures: [["flatten", ""]] });

    assert.throws(
        () => saveCopy(job, "/w/stamped-1.v", "/w/staged-1.jpg", {
            metadataSource: "/owned/source.jpg",
        hasAlpha: false,
            size: { width: 600, height: 400 }
        }),
        /the stamped copy is not a file with anything in it/u
    );
});

test("a copy that is not the size of the photograph is not the copy", () => {
    // A file with something in it is not a photograph. Asked of the copy
    // itself, through the reader that will have to open it.
    const host = createFakeHost({ files: ["/a/one.jpg"], stampWidth: 90, stampHeight: 20 });
    const job = { ...makeJob(host), workspace: WORKSPACE };

    assert.throws(
        () => saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/stamp-x.jpg`, {
            metadataSource: "/owned/source.jpg",
        hasAlpha: false,
            size: { width: 600, height: 400 }
        }),
        /is 90 by 20 pixels where 600 by 400 were expected/u
    );
});

test("either dimension is enough to say the copy is not the photograph", () => {
    const job = { ...makeJob(createFakeHost({ stampHeight: 400 })), workspace: WORKSPACE };

    assert.throws(
        () => saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/stamp-x.jpg`, {
            metadataSource: "/owned/source.jpg",
        hasAlpha: false,
            size: { width: 200, height: 399 }
        }),
        /is 200 by 400 pixels where 200 by 399 were expected/u
    );
});

test("ordinary TIFF copies retain capture metadata before validation, and failed retention cannot report success", () => {
    const { host, job } = jobOn();
    saveCopy(job, "/owned/stamped.v", "/owned/copy.tif", { metadataSource: "/owned/source.tif", hasAlpha: false, size: { width: 600, height: 400 } });
    const command = host.commands.find((entry) => entry.includes("'-userParam'"));
    assert.ok(command.includes("'source=/owned/source.tif'"));
    assert.ok(command.includes("'target=/owned/copy.tif'"));
    assert.match(command, /SetNewValuesFromFile/u);
    const broken = jobOn({ failures: [["'-userParam'", new Error("metadata retention refused")]] });
    assert.throws(() => saveCopy(broken.job, "/owned/stamped.v", "/owned/copy.tif", { metadataSource: "/owned/source.tif", hasAlpha: false, size: { width: 600, height: 400 } }), /metadata retention refused/u);
});

test("a successful process cannot validate an unassociated or failed metadata write", () => {
    const packet = { ExifToolVersion: "13.55", TargetFile: "/owned/copy.tif", WriteStatus: "1", RawWriteStatus: "1", VerifiedGPS: "1", GPSInputCount: "4", RequiredSetCount: "13", FailureCount: "0", FailureText: "", RebuiltTargetWebPExif: "0" };
    for (const changes of [{ TargetFile: "/other.tif" }, { TargetFile: undefined }, { WriteStatus: "0", RawWriteStatus: "1", VerifiedGPS: "0", FailureCount: "1", FailureText: "Raw GPS read-back differs." }]) {
        const response = JSON.stringify([{ SourceFile: "/owned/source.tif", FileName: { ...packet, ...changes } }]);
        const { host, job } = jobOn({ failures: [["'-userParam'", response]] });
        assert.throws(() => saveCopy(job, "/owned/stamped.v", "/owned/copy.tif", { metadataSource: "/owned/source.tif", hasAlpha: false, size: { width: 600, height: 400 } }));
        assert.ok(host.commands.some((command) => command.includes("'flatten'")), "the candidate exists before the metadata refusal");
        assert.equal(host.commands.some((command) => command.includes("vipsheader")), false, "an invalid metadata write never reaches final candidate validation");
    }
});
