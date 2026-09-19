"use strict";

const {
    setContents,
    sameContents,
    drawingToken
} = require("./fake-contents.cjs");
const { describe, extractProfile } = require("./fake-exiftool.cjs");

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
    colourspace: 3,
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
/*
 * cmp exits 0 when the files match, 1 when they differ and 2 when it could
 * not read one of them, and doShellScript raises the exit status -- so the
 * fake raises it too. Collapsed into one failure, a comparison that could not
 * be made would look exactly like two files that differ.
 */
function refused(message, status) {
    const failure = new Error(message);

    failure.errorNumber = status;

    return failure;
}

function compare(state, argv) {
    for (const path of argv.slice(2)) {
        if (!state.files.has(path)) {
            throw refused("cmp: no such file", 2);
        }
    }

    if (!sameContents(state, argv[2], argv[3])) {
        throw refused("files differ", 1);
    }

    return "";
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

    // The description is "Family, Weight Size" -- the comma is what keeps a
    // family whose name ends in a style word from being read as a style.
    return drawingToken(String(argv[at + 1]).replace(/,? [^,]*\d+$/u, ""));
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
