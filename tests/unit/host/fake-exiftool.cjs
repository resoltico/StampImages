"use strict";

/*
 * What exiftool answers: what a photograph says about itself, and its color
 * profile written out to a file.
 */

const { setContents } = require("./fake-contents.cjs");

/*
 * exiftool answers with a list of one entry, because it is built to be asked
 * about many files at once. A test gives the state a `metadata` map to say
 * what a particular photograph claims about itself.
 */
function describe(state, argv) {
    const path = argv.at(-1);

    if (!state.files.has(path) && !state.runnable.has(path)) {
        return "[]";
    }

    return JSON.stringify([
        { SourceFile: path, FileName: { ExifToolVersion: "13.55", ...state.metadata.get(path) } }
    ]);
}

/*
 * exiftool writing a photograph's color profile to standard output, which is
 * also how the question "does this photograph carry one" is asked: a
 * photograph with none succeeds and writes nothing at all, so the redirection
 * leaves an empty file rather than no file. The contents token is the profile
 * itself, so two photographs off one camera compare equal and share one
 * drawing.
 *
 * The command is "exiftool -icc_profile -b SOURCE > WRITTEN", and the
 * redirection is not a quoted argument, so the source is second from the end
 * and the file it lands in is last.
 */
function extractProfile(state, argv) {
    const source = argv.at(-2);
    const written = argv.at(-1);
    const profile = state.profiles.get(source);

    state.files.add(written);

    if (profile) {
        state.emptyFiles.delete(written);
        setContents(state, written, `profile:${profile}`);
    } else {
        state.emptyFiles.add(written);
    }

    return "";
}

function copied(state, argv) {
    const parameters = argv.filter((value, index) => argv[index - 1] === "-userParam");
    const source = parameters.find((value) => value.startsWith("source=")).slice("source=".length);
    const target = parameters.find((value) => value.startsWith("target=")).slice("target=".length);
    const written = state.files.has(target);
    const gps = Object.keys(state.metadata.get(source) ?? {}).filter((key) => /^(?:EXIF|XMP)GPS/u.test(key));
    return JSON.stringify([{ SourceFile: source, FileName: { ExifToolVersion: "13.55", TargetFile: target,
        WriteStatus: written ? "1" : "0", RawWriteStatus: written ? "1" : "0", VerifiedGPS: written ? "1" : "0",
        GPSInputCount: String(gps.length), RequiredSetCount: "13", FailureCount: written ? "0" : "1",
        FailureText: written ? "" : "No private candidate.", RebuiltTargetWebPExif: "0" } }]);
}
module.exports = { describe, extractProfile, copied };
