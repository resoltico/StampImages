"use strict";

/*
 * What a finished run says about itself, in the summary and the detail.
 *
 * Field regressions (2026-11-05, unreleased main): a copy recovered to
 * Downloads was headlined "No stamped copy was created", the reason the folder
 * refused it was only in the JSON, every rejection was printed twice, an
 * invalid request printed "0 saved." and one earlier copy was "1 stamped
 * copies".
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { describe, detailOf } = require("../../../src/host/completion.js");
const { runOutcome } = require("../../../src/core/outcomes.js");
const { reportNothing } = require("../../../src/host/reporting.js");

const DENIED = {
    code: "publication",
    stage: "publication",
    message: "The image could not be saved to its requested destination.",
    diagnostic: { code: 13, domain: "NSPOSIXErrorDomain", message: "Permission denied", state: "denied" }
};

function recovered(issues = [DENIED]) {
    return { source: "/ro/a.jpg", state: "recovered", recovery: "/Users/u/Downloads/a_stamped.jpg", issues, missingMetadata: [] };
}

test("a copy kept elsewhere is counted in the headline, not denied", () => {
    const headline = describe(runOutcome([recovered()]));

    assert.doesNotMatch(headline, /No stamped copy/u);
    assert.match(headline, /1 copy could not be saved where it was meant to go and was kept elsewhere/u);
});

test("saved and recovered copies are both said", () => {
    const result = runOutcome([
        { source: "/a.jpg", state: "saved", output: "/a_stamped.jpg", issues: [] },
        { ...recovered(), source: "/b.jpg" },
        { ...recovered(), source: "/c.jpg" }
    ]);

    assert.match(describe(result), /Created 1 stamped copy\. 2 copies could not be saved where they were meant to go and were kept elsewhere/u);
});

test("nothing made at all is still said plainly", () => {
    assert.match(describe(runOutcome([{ source: "/a.jpg", state: "failed", issues: [] }])), /No stamped copy was created\./u);
});

test("the reason a folder refused the copy is in the words a person reads", () => {
    assert.match(detailOf(runOutcome([recovered()])), /requested destination\. Its folder cannot be written \(permission denied\)\./u);
    const unknown = { ...DENIED, diagnostic: { state: "unknown" } };

    assert.match(detailOf(runOutcome([recovered([unknown])])), /requested destination\.\n\n/u);
});

test("an invalid request is not summarized as a run that saved nothing", () => {
    const invalid = { ...runOutcome([], [], [], [{ code: "integer", stage: "settings", message: "Margin must be a whole number." }]), state: "invalid" };

    assert.equal(detailOf(invalid), "Margin must be a whole number.");
});

test("one earlier copy is one copy", () => {
    const result = runOutcome([{ source: "/a.jpg", state: "saved", output: "/a_stamped.jpg", issues: [] }], [], ["/a_stamped 2.jpg"]);

    assert.match(detailOf(result), /Left alone: 1 stamped copy from an earlier run\./u);
    assert.match(detailOf(runOutcome([], [], ["/x", "/y"])), /Left alone: 2 stamped copies/u);
});

test("each rejection is printed once", () => {
    const rejected = [{ path: "/a/x.gif", name: "x.gif", reason: "not a supported format" }];
    const detail = detailOf(reportNothing(null, true, rejected));

    assert.equal(detail.split("/a/x.gif: not a supported format").length - 1, 1);
    assert.doesNotMatch(detail, /None of the selected items/u, "the headline already says it");
});

test("a crowded stamp says where it went", () => {
    const result = runOutcome([{ source: "/a.jpg", state: "saved", output: "/o.jpg", issues: [], crowded: true }]);

    assert.match(detailOf(result), /placed against the opposite edge/u);
});

test("the detail lists copies by folder, then notes, failures, refusals and the version", () => {
    const { detailOf: detail } = require("../../../src/host/completion.js");
    const { VERSION } = require("../../../src/core/version.js");
    const result = runOutcome([
        { source: "/t/a.jpg", state: "saved", output: "/t/a_stamped.jpg", issues: [], missingMetadata: ["GPS coordinates"] },
        { source: "/t/b.jpg", state: "saved", output: "/t/b_stamped.jpg", issues: [], crowded: true },
        { source: "/u/c.jpg", state: "failed", issues: [{ code: "damaged", message: "This image is damaged or incomplete." }] },
        { source: "/u/d.jpg", state: "nothing-to-stamp", reason: "it does not say when it was taken", issues: [] },
        { source: "/u/e.jpg", state: "not-started", issues: [] }
    ], [{ path: "/u/x.gif", name: "x.gif", reason: "This file is not a supported format." }]);

    assert.equal(detail(result), [
        "2 saved; 1 failed; 1 with nothing to stamp; 1 not started; 1 not included; 1 copy missing requested metadata.",
        "Saved to:\n/t/\na_stamped.jpg\nb_stamped.jpg",
        "Notes:\na_stamped.jpg: Missing requested metadata: GPS coordinates.\nb_stamped.jpg: The margin is larger than this image has room for, so the stamp was placed against the opposite edge.",
        "Nothing to stamp:\n/u/d.jpg: it does not say when it was taken",
        "Could not stamp:\n/u/c.jpg: This image is damaged or incomplete.",
        "Not started: 1",
        "Not included from your selection:\n/u/x.gif: This file is not a supported format.",
        `Stamp Images ${VERSION}`
    ].join("\n\n"));
});

test("technical details are key: value lines without stacks", () => {
    const { diagnosticLines } = require("../../../src/host/completion.js");

    assert.deepEqual(diagnosticLines({ code: "damaged", diagnostic: { command: "vips x", message: "a\r\nb", stack: "s" }, empty: null }),
        ["code: damaged", "diagnostic: command: vips x", "diagnostic: message: a\nb"]);
});

test("refusals agreed to in the review do not make a finished run read as one with issues", () => {
    const saved = { source: "/a.jpg", state: "saved", output: "/a_stamped.jpg", issues: [], missingMetadata: [] };
    const refused = [{ path: "/x.gif", name: "x.gif", reason: "This file is not a supported format." }];

    assert.equal(describe(runOutcome([saved], refused)), "Created 1 stamped copy.");
    assert.equal(describe(runOutcome([{ ...saved, missingMetadata: ["GPS coordinates"] }], refused)), "Finished with issues. Created 1 stamped copy.");
    assert.equal(describe(runOutcome([saved], refused, [], [{ code: "cleanup", message: "x" }])), "Finished with issues. Created 1 stamped copy.");
    assert.equal(describe(runOutcome([{ ...saved, issues: [{ code: "cleanup", message: "x" }] }], refused)), "Finished with issues. Created 1 stamped copy.");
    assert.equal(describe(runOutcome([], refused)), "Finished with issues. No stamped copy was created.");
});

test("a selection with nothing admitted is headlined as nothing to stamp", () => {
    const nothing = reportNothing(null, true, [{ path: "/x.gif", name: "x.gif", reason: "This file is not a supported format." }]);

    assert.equal(describe(nothing), "Nothing to stamp.");
    assert.equal(describe(runOutcome([], [], [], [{ code: "fault", message: "boom" }])), "Finished with issues. No stamped copy was created.");
});

test("the dialog detail ends with the elapsed time and then the version", () => {
    const { VERSION } = require("../../../src/core/version.js");
    const result = { ...runOutcome([{ source: "/a.jpg", state: "saved", output: "/o/a_stamped.jpg", issues: [] }]), elapsed: "1 second" };

    assert.ok(detailOf(result).endsWith(`\n\nElapsed: 1 second\n\nStamp Images ${VERSION}`));
    assert.ok(detailOf(result, { commandLine: true }).endsWith("Elapsed: 1 second"));
});


test("unmapped-loader evidence is available through completion Details", () => {
    const { showCompletion } = require("../../../src/host/completion.js");
    const responses = ["Details", "Back", "OK"], seen = [];
    const app = { displayDialog(message) { seen.push(message); return { buttonReturned: responses.shift() }; } };
    const result = runOutcome([{ source: "/a.jpg", state: "saved", output: "/a_stamped.jpg", issues: [] }], [{
        path: "/misnamed.png", code: "unsupported-content", stage: "inspection",
        reason: "This file's content is not a supported still image; use JPEG, PNG, HEIC, TIFF, WebP or AVIF.",
        diagnostic: { loader: "gifload" }
    }]);
    showCompletion(app, result);
    assert.match(seen[1], /loader: gifload/u);
    assert.doesNotMatch(seen[0], /gifload/u);
});
