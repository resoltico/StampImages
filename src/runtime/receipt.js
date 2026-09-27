"use strict";

const { plural } = require("../core/numbers.js");

/*
 * The machine-readable outcome of a headless run.
 *
 * A caller needs two things that cannot both travel on the same channel: the
 * receipt, and an exit status that reflects whether the request was honoured.
 * osascript returns the script's value on success and its error on failure, so
 * an incomplete run either reports what happened or reports that it failed —
 * not both. Writing the receipt to standard output directly settles that: the
 * receipt goes out, then the error propagates and the process exits non-zero.
 */

const UTF8_ENCODING = 4;

/*
 * The namespace to write through, or null when there is none. A missing
 * bridge, a namespace that is not one, and a Foundation that will not load
 * are all the same answer, so they are all reached the same way.
 */
function foundation(objc, ns) {
    try {
        objc.import("Foundation");

        return ns ?? null;
    } catch {
        return null;
    }
}

/*
 * Reports whether it wrote, so a caller is never told a receipt exists when
 * the bridge was unavailable and it does not.
 */
function writeReceipt(text, ns = foundation(globalThis.ObjC, globalThis.$)) {
    if (!ns) {
        return false;
    }

    ns.NSFileHandle.fileHandleWithStandardOutput.writeData(
        ns(String(text)).dataUsingEncoding(UTF8_ENCODING)
    );

    return true;
}

/*
 * Where every photograph that was asked for ended up.
 *
 * Five columns, and they add up to the request or the ledger has lost
 * something. The last of them is the one a report without it cannot state: a
 * run somebody stopped said how many it had saved and nothing about the rest,
 * so a batch of two hundred stopped after three read as a batch of three.
 */
function ledgerOf(result) {
    const accounted = result.outputs.length +
        result.failures.length +
        result.nothing.length +
        result.rejected.length;

    return {
        stamped: result.outputs.length,
        failed: result.failures.length,
        nothing: result.nothing.length,
        rejected: result.rejected.length,
        notAttempted: Math.max(result.requested - accounted, 0)
    };
}

/*
 * A run is completely successful only when every photograph that was asked
 * for came back as a stamped copy, and no copy lacks a date or a place it was
 * asked to show. Stated as counts rather than as a list of the ways it can go
 * wrong, so a way of falling short that nobody thought of here cannot be
 * reported as a success. A copy lacking something overlaps the stamped
 * column rather than forming a sixth, which would count one photograph twice.
 */
function isCompleteSuccess(result) {
    return result.outputs.length === result.requested &&
        (result.missingMetadata ?? []).length === 0;
}

const COLUMNS = [
    ["failed", "failed"],
    ["nothing", "with nothing to stamp"],
    ["rejected", "not usable"],
    ["notAttempted", "not attempted"]
];

function describeIncomplete(result) {
    const ledger = ledgerOf(result);
    const counts = COLUMNS
        .filter(([column]) => ledger[column] > 0)
        .map(([column, said]) => `${ledger[column]} ${said}`);

    const omissions = (result.missingMetadata ?? []).length;

    if (omissions > 0) {
        counts.push(`${plural(omissions, "copy", "copies")} missing requested metadata`);
    }

    return "The request was not completely honoured: " +
        `${ledger.stamped} of ${result.requested} stamped, ${counts.join(", ")}.`;
}

module.exports = {
    foundation,
    writeReceipt,
    ledgerOf,
    isCompleteSuccess,
    describeIncomplete
};
