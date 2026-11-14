"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { runOutcome, noImagesOutcome } = require("../../../src/core/outcomes.js");
const { summarizeRun } = require("../../../src/core/run-summary.js");
const { headline, countsLine, summaryText, reportText, describeRejections, noImagesHeadline, describeNoImages } = require("../../../src/core/run-report.js");
const saved = { state: "saved", source: "/in/a.jpg", output: "/out/a.jpg", issues: [] };

test("core headlines preserve completion, partial, stopped, invalid and no-image wording", () => {
    const describe = (outcome) => headline(summarizeRun(outcome));
    assert.equal(describe(runOutcome([saved])), "Created 1 stamped copy.");
    assert.equal(describe(runOutcome([saved, { ...saved, source: "/in/b.jpg", output: "/out/b.jpg" }])), "Created 2 stamped copies.");
    assert.equal(describe(runOutcome([{ state: "failed", issues: [] }])), "Finished with issues. No stamped copy was created.");
    assert.equal(describe(runOutcome([{ state: "canceled", issues: [] }])), "Stopped. No stamped copy was created.");
    assert.equal(describe(runOutcome([], [], [], [{ code: "text", stage: "settings", message: "Invalid" }])), "The request is invalid.");
    assert.equal(describe(noImagesOutcome([])), "Nothing to stamp.");
    assert.equal(describe(runOutcome([{ state: "recovered", issues: [], recovery: "/kept/a.jpg" }])), "Finished with issues. 1 copy could not be saved where it was meant to go and was kept elsewhere; the location is below.");
});

test("summary facts retain saved grouping, all states, refusals and missing metadata", () => {
    const images = [saved, { ...saved, output: "/other/b.jpg", missingMetadata: ["date/time"] }, { ...saved, output: "/out/c.jpg" },
        ...["recovered", "failed", "nothing-to-stamp", "canceled", "not-started"].map((state) => ({ state, source: `/in/${state}.jpg`, issues: [] }))];
    const summary = summarizeRun(runOutcome(images, [{ name: "no.gif", reason: "Not supported" }], ["/old.jpg"]));
    assert.deepEqual(summary.counts, { saved: 3, recovered: 1, failed: 1, "nothing-to-stamp": 1, canceled: 1, "not-started": 1 });
    assert.deepEqual(summary.saved, [{ folder: "/out/", outputs: [{ path: "/out/a.jpg", name: "a.jpg" }, { path: "/out/c.jpg", name: "c.jpg" }] }, { folder: "/other/", outputs: [{ path: "/other/b.jpg", name: "b.jpg" }] }]);
    assert.equal(countsLine(summary), "3 saved; 1 recovered; 1 failed; 1 with nothing to stamp; 1 canceled; 1 not started; 1 not included; 1 copy missing requested metadata.");
    assert.equal(summary.notStarted, 1);
    assert.equal(summary.excluded[0], "/old.jpg");
    assert.equal(countsLine(summarizeRun(runOutcome())), "");
});

test("core report sections and metadata notes are literal contracts", () => {
    const result = { ...runOutcome([{ ...saved, missingMetadata: ["date/time"], invalidMetadata: ["GPS coordinates"], crowded: true, expanded: true, substituted: true, unconverted: true },
        { state: "nothing-to-stamp", source: "/in/no-date.jpg", reason: "No date", issues: [] },
        { state: "failed", source: "/in/bad.jpg", issues: [{ code: "operation", message: "Failed" }] },
        { state: "canceled", source: "/in/stopped.jpg", issues: [] },
        { state: "not-started", source: "/in/later.jpg", issues: [] }], [{ name: "no.gif", reason: "Unsupported" }], ["/old.jpg"], [{ code: "workspace", message: "Kept work", diagnostic: { path: "/workspace" } }]), elapsed: "1 second" };
    assert.equal(reportText(result), [
        "Stopped. Created 1 stamped copy.",
        "1 saved; 1 failed; 1 with nothing to stamp; 1 canceled; 1 not started; 1 not included; 1 copy missing requested metadata.",
        "Saved to:\n/out/\na.jpg",
        "Notes:\na.jpg: Missing requested metadata: date/time.\na.jpg: Recorded but not valid, so left off: GPS coordinates.\na.jpg: The margin is larger than this image has room for, so the stamp was placed against the opposite edge.\na.jpg: Written in color to preserve the caption color.\na.jpg: Some characters are not in the chosen typeface and were drawn in another one.\na.jpg: The caption color could not be converted to the image's color profile.",
        "Nothing to stamp:\n/in/no-date.jpg: No date",
        "Could not stamp:\n/in/bad.jpg: Failed\n/in/stopped.jpg: canceled",
        "Not started: 1", "Not included from your selection:\nno.gif: Unsupported", "Kept work\n/workspace",
        "Left alone: 1 stamped copy from an earlier run.", "Elapsed: 1 second"
    ].join("\n\n"));
    assert.equal(summaryText(summarizeRun(result), false), reportText(result, false).replace(/\n\nElapsed: 1 second$/u, ""));
});

test("publication reasons and recovery details stay in the human report", () => {
    const reasons = { denied: "Its folder cannot be written (permission denied).", "cross-device": "Its folder is on a volume that could not take the finished copy.", unsupported: "Its folder's filesystem does not support saving the copy safely." };
    for (const [state, sentence] of Object.entries(reasons)) {
        const outcome = runOutcome([{ state: "recovered", source: "/in/a.jpg", recovery: "/kept/a.jpg", issues: [{ code: "publication", message: "Cannot save.", diagnostic: { state } }] }]);
        assert.ok(reportText(outcome).endsWith(`Recovered copies:\n/kept/a.jpg\n/in/a.jpg\nCannot save. ${sentence}`));
    }
    const outcome = runOutcome([{ state: "recovered", source: "/in/a.jpg", recovery: "/kept/a.jpg", issues: [] }]);
    assert.equal(reportText(outcome, false), "1 recovered.\n\nRecovered copies:\n/kept/a.jpg\n/in/a.jpg");
});

test("no-image dialogs retain both headlines and Finder instructions", () => {
    const rejected = [{ path: "/no.gif", reason: "Unsupported" }];
    assert.equal(noImagesHeadline(rejected), "Nothing to stamp.");
    assert.equal(noImagesHeadline([]), "No images selected.");
    assert.equal(describeNoImages(rejected), "Nothing to stamp.\n\n/no.gif: Unsupported");
    assert.equal(describeNoImages(rejected, false), "/no.gif: Unsupported");
    assert.equal(describeNoImages([], false), "Select JPEG, PNG, HEIC, TIFF, WebP or AVIF files or folders in Finder, then run the action again.");
    assert.equal(describeRejections([], "Unused"), "");
    assert.equal(describeRejections(rejected, "Not included:"), "Not included:\n/no.gif: Unsupported");
});

test("recovered metadata notes name the source and unknown publication reasons keep their own message", () => {
    const outcome = runOutcome([{ state: "recovered", source: "/in/a.jpg", recovery: "/kept/a.jpg", missingMetadata: ["date/time"], issues: [{ code: "publication", message: "Cannot save." }] }]);
    assert.equal(reportText(outcome, false), "1 recovered; 1 copy missing requested metadata.\n\nNotes:\na.jpg: Missing requested metadata: date/time.\n\nRecovered copies:\n/kept/a.jpg\n/in/a.jpg\nCannot save.");
    assert.equal(describeNoImages([]), "No images selected.\n\nSelect JPEG, PNG, HEIC, TIFF, WebP or AVIF files or folders in Finder, then run the action again.");
});

test("request diagnostics without a path do not add a blank location", () => {
    assert.equal(reportText(runOutcome([], [], [], [{ code: "fault", message: "Failed", diagnostic: {} }]), false), "Failed");
    assert.equal(describeNoImages([{ name: "no.gif", reason: "Unsupported" }], false), "no.gif: Unsupported");
});

test("summary kinds and finished-note membership reflect every image", () => {
    const refused = [{ name: "no.gif", reason: "Unsupported" }];
    for (const second of [{ ...saved, missingMetadata: ["date/time"] }, { ...saved, issues: [{ code: "cleanup", message: "Cleanup failed" }] }, { state: "failed", issues: [], source: "/bad.jpg" }]) {
        const summary = summarizeRun(runOutcome([saved, second]));
        assert.equal(summary.kind, "some-saved");
        assert.equal(headline(summary), "Finished with issues. Created 1 stamped copy.".replace("1 stamped copy", second.state === "saved" ? "2 stamped copies" : "1 stamped copy"));
    }
    assert.equal(summarizeRun(runOutcome([], refused)).kind, "none-saved");
    const completed = summarizeRun(runOutcome([saved], [], [], [{ code: "no-images" }]));
    assert.equal(completed.kind, "some-saved", "a no-images issue cannot conceal existing saved work");
    const recovered = { state: "recovered", source: "/in/b.jpg", recovery: "/kept/b.jpg", issues: [] };
    const failed = { state: "failed", source: "/in/c.jpg", missingMetadata: ["date/time"], issues: [] };
    assert.deepEqual(summarizeRun(runOutcome([saved, recovered, failed])).notes, [saved, recovered]);
});

test("invalid request counts stay absent even when the selection had refusals", () => {
    const summary = summarizeRun(runOutcome([], [{ path: "/bad.gif", reason: "Unsupported" }], [], [{ stage: "settings", code: "text", message: "Invalid text" }]));
    assert.equal(countsLine(summary), "");
    assert.equal(summaryText(summarizeRun(runOutcome([saved]))), "Created 1 stamped copy.\n\n1 saved.\n\nSaved to:\n/out/\na.jpg");
});

test("reports separate multiple folders, metadata fields and failure reasons", () => {
    const result = runOutcome([{ ...saved, missingMetadata: ["date/time", "GPS coordinates"], invalidMetadata: ["date/time", "GPS coordinates"] },
        { ...saved, source: "/in/b.jpg", output: "/other/b.jpg", missingMetadata: ["date/time"] },
        { state: "failed", source: "/in/c.jpg", issues: [{ code: "operation", message: "Failed.", diagnostic: { state: "denied" } }, { code: "cleanup", message: "Cleanup failed." }] }]);
    assert.equal(reportText(result, false), ["2 saved; 1 failed; 2 copies missing requested metadata.", "Saved to:\n/out/\na.jpg\n\n/other/\nb.jpg",
        "Notes:\na.jpg: Missing requested metadata: date/time, GPS coordinates.\na.jpg: Recorded but not valid, so left off: date/time, GPS coordinates.\nb.jpg: Missing requested metadata: date/time.",
        "Could not stamp:\n/in/c.jpg: Failed. Cleanup failed."].join("\n\n"));
    assert.equal(describeNoImages([{ path: "/a.gif", reason: "Unsupported" }, { name: "b.gif", reason: "Unreadable" }], false), "/a.gif: Unsupported\nb.gif: Unreadable");
});
