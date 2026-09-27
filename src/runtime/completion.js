"use strict";

const { plural } = require("../core/numbers.js");
const { dirname } = require("../core/paths.js");
const { describeCrowding } = require("../core/geometry.js");
const { describeExcluded } = require("../core/naming.js");
const { describeExpanded, describeUnconverted } = require("../core/colour.js");
const { ledgerOf } = require("./receipt.js");

/*
 * What a person is told when a run is over: what was made and where, then
 * what fell short and why. What a headless caller is told instead is
 * reporting.js's to say.
 */

/*
 * Every folder that received a copy, not merely the first: a selection that
 * spans two folders puts copies in two folders.
 */
function describeDestinations(outputs) {
    const folders = [...new Set(outputs.map((output) => dirname(output)))];

    return folders.length === 1
        ? folders[0]
        : `${folders.length} folders:\n${folders.join("\n")}`;
}

/*
 * A run somebody stopped says how much it did not get to, or a batch of two
 * hundred stopped after one reads as a batch of one. "Not stamped" rather
 * than "not started": the image in hand when the stop arrived was partway
 * through. Selected items that were never images are not counted here; they
 * are listed with their reasons below.
 */
function stoppedLine(result, ledger) {
    return result.stopped
        ? `Stopped. ${plural(
            result.requested - ledger.stamped - ledger.rejected, "image"
        )} not stamped.`
        : "";
}

/*
 * The paragraph a person reads first: what was made and where it went,
 * counted from the copies that exist rather than from what was selected.
 */
function describe(result) {
    const ledger = ledgerOf(result);

    return [
        result.failures.length > 0 ? "Finished with errors." : "",
        [
            ledger.stamped > 0
                ? `Created ${plural(ledger.stamped, "stamped copy", "stamped copies")}.`
                : "No stamped copy was created.",
            stoppedLine(result, ledger),
            result.outputs.length > 0
                ? `Saved to: ${describeDestinations(result.outputs)}`
                : ""
        ].filter(Boolean).join("\n")
    ].filter(Boolean).join("\n\n");
}

function named(entries, say) {
    return entries.map((entry) => `${entry.name}: ${say(entry)}`);
}

function section(heading, entries, say) {
    return entries.length > 0
        ? `${heading}\n${named(entries, say).join("\n")}`
        : "";
}

/*
 * Then one paragraph for each way an image fell short, in the order and the
 * words Image Files to PDF uses where the two say the same thing. A copy that
 * lacks part of what was asked for exists, so it is listed rather than
 * counted against the copies; a folder that was refused is not an image that
 * failed.
 */
function detailOf(result) {
    const notes = [
        ...result.excluded.length > 0 ? [describeExcluded(result.excluded)] : [],
        ...result.crowded > 0 ? [describeCrowding(result.crowded)] : [],
        ...result.expanded > 0 ? [describeExpanded(result.expanded)] : [],
        ...result.unconverted > 0 ? [describeUnconverted(result.unconverted)] : []
    ];
    const sections = [
        section(`Could not stamp ${plural(result.failures.length, "image")}:`,
            result.failures, (failure) => failure.message),
        section("No copy, because there was nothing to stamp:",
            result.nothing, (entry) => entry.reason),
        section("Stamped without everything asked for:",
            result.missingMetadata ?? [],
            (entry) => `no ${entry.fields.join(" or ")} in its metadata`),
        section("Not included from your selection:",
            result.rejected, (entry) => entry.reason),
        notes.join("\n")
    ].filter(Boolean);

    return sections.length > 0 ? `\n\n${sections.join("\n\n")}` : "";
}

module.exports = { describe, detailOf, describeDestinations };
