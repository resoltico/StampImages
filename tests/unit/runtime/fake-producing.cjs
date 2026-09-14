"use strict";

const {
    setContents,
    sameContents,
    drawingToken
} = require("./fake-contents.cjs");

/*
 * What the tools leave behind.
 *
 * Only the argument each operation actually writes is created: creating every
 * path-shaped argument would make verifyFileWritten unfailable, and a stage
 * that silently produced nothing would go unnoticed.
 *
 * Which argument that is differs by operation, which is the whole reason this
 * is a table rather than a rule. `vips text out.png "words"` writes its second
 * argument and `vips composite2 base overlay out.v over` writes its fourth,
 * and a fake that assumed one position for all of them would report files
 * written that were not.
 */

const VIPS_OUTPUT_ARGUMENT = {
    text: 2,
    black: 2,
    linear: 3,
    rank: 3,
    embed: 3,
    // vips names this one with an underscore; the table is keyed by what
    // vips is actually asked.
    "icc_transform": 3,
    bandjoin: 3,
    autorot: 3,
    flatten: 3,
    copy: 3,
    thumbnail: 3,
    composite2: 4
};

/*
 * A comparison of two files, answered from what each of them holds.
 */
function compare(state, argv) {
    for (const path of argv.slice(2)) {
        if (!state.files.has(path)) {
            throw new Error("cmp: no such file");
        }
    }

    if (!sameContents(state, argv[2], argv[3])) {
        // cmp fails when the files differ.
        throw new Error("files differ");
    }

    return "";
}

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
        { SourceFile: path, ...state.metadata.get(path) }
    ]);
}

/*
 * What the file that was just written holds: the face a drawing came out in,
 * or a token of its own for anything else.
 */
function contentsDrawn(state, argv, written) {
    const at = argv.indexOf("--font");

    if (argv[1] !== "text" || at < 0) {
        return `file:${written}`;
    }

    return drawingToken(state, String(argv[at + 1]).replace(/ \d+$/u, ""));
}

/*
 * vips reads its encoder settings off the end of the path it is given, and
 * creates the file at the path itself.
 */
function drew(state, argv) {
    const position = VIPS_OUTPUT_ARGUMENT[argv[1]];

    if (position === undefined) {
        throw new Error(`unsupported operation: ${argv[1]}`);
    }

    const written = String(argv[position]).replace(/\[.*$/u, "");

    state.files.add(written);
    setContents(state, written, contentsDrawn(state, argv, written));

    return "";
}

/*
 * exiftool writing a photograph's colour profile out to a file, which is also
 * how the question "does this photograph carry one" is asked: a photograph
 * with none produces no file. The contents token is the profile itself, so
 * two photographs off one camera compare equal and share one drawing.
 */
function extractProfile(state, argv) {
    const source = argv.at(-1);
    const profile = state.profiles.get(source);

    if (!profile) {
        return "0 output files created";
    }

    const stem = String(source).split("/").at(-1).replace(/\.[^.]*$/u, "");
    const written = String(argv.at(-2)).replace("%f", stem);

    state.files.add(written);
    setContents(state, written, `profile:${profile}`);

    return "1 output files created";
}

function produceOutput(state, argv, command) {
    if (command.includes("/cmp")) {
        return compare(state, argv);
    }

    if (command.includes("-icc_profile")) {
        return extractProfile(state, argv);
    }

    if (command.includes("exiftool")) {
        return describe(state, argv);
    }

    return drew(state, argv);
}

module.exports = { produceOutput, VIPS_OUTPUT_ARGUMENT };
