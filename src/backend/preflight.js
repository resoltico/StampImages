"use strict";
const { FAIL_ON_DAMAGE } = require("./commands.js");
const { buildMetadataArgv, captureProjection } = require("./queries.js");

/*
 * Verify behavior, not presence alone. vips must accept the required flags
 * before failing on a nonexistent input. vipsheader must read width 1 from
 * the built-in RGB PNG. ExifTool must return its single-file JSON record
 * when asked about its own executable; a missing-file complaint proves none
 * of that parsing contract.
 */
const PROBE_IMAGE = "/nonexistent-stamp-images-preflight.png";
const PROBE_OUTPUT = "/nonexistent-stamp-images-preflight.v";
const PROBE_WIDTH = "10";

function buildVipsProbeArgv(vipsPath) {
    return [
        vipsPath,
        "thumbnail",
        PROBE_IMAGE,
        PROBE_OUTPUT,
        PROBE_WIDTH,
        "--size=down",
        "--export-profile",
        "srgb",
        FAIL_ON_DAMAGE
    ];
}

const VIPSHEADER_PROBE_IMAGE = "\\0211\\0120\\0116\\0107\\0015\\0012\\0032\\0012\\0000\\0000\\0000\\0015\\0111\\0110\\0104\\0122\\0000\\0000\\0000\\0001\\0000\\0000\\0000\\0001\\0010\\0002\\0000\\0000\\0000\\0220\\0167\\0123\\0336\\0000\\0000\\0000\\0014\\0111\\0104\\0101\\0124\\0170\\0234\\0143\\0120\\0016\\0357\\0004\\0000\\0001\\0244\\0001\\0004\\0360\\0075\\0155\\0310\\0000\\0000\\0000\\0000\\0111\\0105\\0116\\0104\\0256\\0102\\0140\\0202";

function buildVipsheaderProbeArgv(vipsheaderPath) {
    return [vipsheaderPath, "-f", "width"];
}

function isVipsheaderUsable(probeOutput) { return String(probeOutput).trim() === "1"; }

/*
 * Asked about itself, because preflight runs before anybody has chosen a
 * photograph and a probe needs a file that exists.
 */
function buildExiftoolProbeArgv(exiftoolPath) {
    return buildMetadataArgv(exiftoolPath, exiftoolPath, { dateFormat: "iso-minutes", coordinateFormat: "decimal" });
}

/*
 * Asserted rather than assumed: vips names the loader it reached for before
 * complaining that the file is not there, and it only gets that far once it
 * has accepted the flags. Asking instead that a particular complaint is
 * absent passes a vips that printed nothing at all because it crashed.
 */
function isVipsUsable(probeOutput) {
    return /VipsForeignLoad/u.test(String(probeOutput));
}

/*
 * Not a substring of the output but the thing the adapter will actually do
 * with it: a list, with an entry, naming the file it was asked about. A build
 * that printed a warning, an empty list, or JSON of some other shape has not
 * shown it can answer the questions this program asks.
 */
function isExiftoolUsable(probeOutput, source) {
    try { captureProjection(probeOutput, source); return true; }
    catch { return false; }
}

const INSTALL_COMMAND = "brew install exiftool vips";
const HOMEBREW_URL = "https://brew.sh";

function problemReason(problem) {
    if (problem.kind === "missing") { return `${problem.tool} is not installed.`; }
    if (problem.tool === "vipsheader" && problem.kind === "unusable") { return "vipsheader could not read the built-in PNG image."; }
    return `${problem.tool} is installed but does not do what this needs: ${problem.flags}.`;
}

function describeProblem(problem) {
    const reason = problemReason(problem);
    return problem.override
        ? `- ${problem.override.name}=${JSON.stringify(problem.override.value)} is not usable as ${problem.tool}. ${reason}`
        : `- ${reason}`;
}

/*
 * One message listing everything that is wrong, and one command that fixes it.
 * Reporting only the first problem makes the user install, retry, and discover
 * the next one.
 */
function describeSetupProblems(problems, hasHomebrew) {
    const automatic = problems.filter((problem) => !problem.override);
    const commands = automatic.some((problem) => problem.kind === "unusable") ? `${INSTALL_COMMAND}\nbrew upgrade exiftool vips` : INSTALL_COMMAND;
    const install = hasHomebrew ? `Run this in Terminal:\n\n${commands}` : `Install Homebrew first, from ${HOMEBREW_URL}\n\nthen run:\n\n${commands}`;
    const remedy = [problems.some((problem) => problem.override) ? "Fix or unset the named tool overrides, then try again." : "", automatic.length > 0 ? install : ""].filter(Boolean).join("\n\n");

    return `Setup needed.\n\n${problems.map(describeProblem).join("\n")}\n\n${remedy}`;
}

module.exports = {
    buildVipsheaderProbeArgv,
    isVipsheaderUsable,
    VIPSHEADER_PROBE_IMAGE,
    buildVipsProbeArgv,
    buildExiftoolProbeArgv,
    isVipsUsable,
    isExiftoolUsable,
    describeSetupProblems
};
