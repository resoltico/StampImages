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
    assert.match(headline, /1 copy could not be saved beside its original and was kept elsewhere/u);
});

test("saved and recovered copies are both said", () => {
    const result = runOutcome([
        { source: "/a.jpg", state: "saved", output: "/a_stamped.jpg", issues: [] },
        { ...recovered(), source: "/b.jpg" },
        { ...recovered(), source: "/c.jpg" }
    ]);

    assert.match(describe(result), /Created 1 stamped copy\. 2 copies could not be saved beside their originals and were kept elsewhere/u);
});

test("nothing made at all is still said plainly", () => {
    assert.match(describe(runOutcome([{ source: "/a.jpg", state: "failed", issues: [] }])), /No stamped copy was created\./u);
});

test("the reason a folder refused the copy is in the words a person reads", () => {
    assert.match(detailOf(runOutcome([recovered()])), /requested destination\. Its folder cannot be written \(permission denied\)\./u);
    const unknown = { ...DENIED, diagnostic: { state: "unknown" } };

    assert.match(detailOf(runOutcome([recovered([unknown])])), /requested destination\.$/u);
});

test("an invalid request is not summarised as a run that saved nothing", () => {
    const invalid = { ...runOutcome([], [], [], [{ code: "setting", stage: "settings", message: "Margin must be a whole number." }]), state: "invalid" };

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
    assert.match(detail, /None of the selected items can be stamped\./u);
});

test("a crowded stamp says where it went", () => {
    const result = runOutcome([{ source: "/a.jpg", state: "saved", output: "/o.jpg", issues: [], crowded: true }]);

    assert.match(detailOf(result), /placed against the opposite edge/u);
});
