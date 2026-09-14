"use strict";

/*
 * Capability probes for the external tools.
 *
 * Presence is not enough. A build that is installed and on PATH can still
 * reject a flag this program depends on and fail every run with a message
 * that points at nothing. A version comparison would be the wrong
 * instrument: libvips keeps `--export-profile` as a backward-compatible alias
 * it no longer advertises but still accepts, so the question is whether this
 * build takes the flags we use, not what it is called.
 *
 * The two tools have to be asked differently, which is worth stating because
 * copying one probe onto the other would prove nothing.
 *
 * vips is asked to fail. It is given the real flags and a path that cannot
 * exist: a build that understands the flags gets as far as the loader and
 * names it, and one that does not complains about the flag instead.
 *
 * exiftool cannot be asked that way. Measured: `-notaflag` is not an unknown
 * option to it, it is a request for a tag called "notaflag", so a build that
 * understands nothing we asked for still answers "File not found" exactly as
 * a healthy one does. It is asked to succeed instead, about a file that is
 * certainly there -- its own executable -- and the answer has to be the JSON
 * this program reads. That establishes the whole path in one go: it runs, it
 * takes -json and -n, and what comes back can be parsed.
 */

/*
 * The damage policy, asked for through the one operation that takes it as a
 * flag.
 *
 * The run does not use thumbnail: it puts `fail_on` on the path it reads,
 * because autorot has no flag of its own. That form cannot be probed --
 * measured, vips checks the file exists and sniffs its format before it parses
 * a load option, so a probe naming a file that cannot exist never reaches one.
 * The two are the same enum, added to libvips together, so a build that takes
 * this flag is a build whose loaders take that option.
 *
 * Probed at all because a flag the run depends on that the probe does not
 * exercise is how a vips too old to accept it fails on somebody's photographs
 * instead of before them.
 */
const FAIL_ON_PROBE = "--fail-on=error";

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
        FAIL_ON_PROBE
    ];
}

/*
 * Asked about itself, because preflight runs before anybody has chosen a
 * photograph and a probe needs a file that exists.
 */
function buildExiftoolProbeArgv(exiftoolPath) {
    return [exiftoolPath, "-json", "-n", "-FileType", exiftoolPath];
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
function isExiftoolUsable(probeOutput) {
    try {
        const answered = JSON.parse(String(probeOutput));

        return Array.isArray(answered) &&
            answered.length > 0 &&
            Boolean(answered[0]) &&
            typeof answered[0].SourceFile === "string" &&
            // A record carrying an error is carrying an error. A build that
            // answers that way about its own executable will answer that way
            // about every photograph.
            !answered[0].Error;
    } catch {
        return false;
    }
}

const INSTALL_COMMAND = "brew install exiftool vips";
const HOMEBREW_URL = "https://brew.sh";

function describeProblem(problem) {
    if (problem.kind === "missing") {
        return `- ${problem.tool} is not installed.`;
    }

    return `- ${problem.tool} is installed but does not do what this needs: ` +
        `${problem.flags}.`;
}

/*
 * One message listing everything that is wrong, and one command that fixes it.
 * Reporting only the first problem makes the user install, retry, and discover
 * the next one.
 */
function describeSetupProblems(problems, hasHomebrew) {
    const remedy = hasHomebrew
        ? `Run this in Terminal:\n\n${INSTALL_COMMAND}`
        : `Install Homebrew first, from ${HOMEBREW_URL}\n\n` +
            `then run:\n\n${INSTALL_COMMAND}`;

    return `Setup needed.\n\n${problems.map(describeProblem).join("\n")}\n\n${remedy}`;
}

module.exports = {
    buildVipsProbeArgv,
    buildExiftoolProbeArgv,
    isVipsUsable,
    isExiftoolUsable,
    describeSetupProblems
};
