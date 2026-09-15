"use strict";

const { buildCompositeArgv, buildFlattenArgv } = require("../core/commands.js");
const { savingPath } = require("../core/formats.js");
const { runArgv } = require("./shell.js");
const { verifyFileWritten } = require("./asking.js");
const { sizeOf } = require("./tinting.js");

/*
 * Putting the stamp on the photograph, and saving what comes out.
 *
 * What the photograph has to be first -- oriented, and in a space that can
 * hold the caption's colour -- is preparing.js.
 *
 * The source is never written to and never even opened for writing. Every
 * stage reads one file and writes another, in a workspace of this run's own,
 * and the copy that leaves it is the one that gets a name a person will see.
 *
 * Between the stages the image is kept in the format vips reads and writes
 * fastest rather than re-encoded each time: compositing onto a JPEG and
 * saving it again at every step would lose a little more of the photograph
 * each time for nothing.
 */

function composite(job, base, stamp, token) {
    const stamped = `${job.workspace}/stamped-${token}.v`;

    runArgv(
        job.app,
        buildCompositeArgv(
            job.tools.vips,
            { base: base.path, overlay: stamp.path },
            stamped,
            stamp.at
        ),
        "stamping the photograph"
    );
    verifyFileWritten(job.app, stamped, "the stamped photograph");

    return stamped;
}

/*
 * Compositing adds an alpha band whether the photograph had one or not, and a
 * copy of a photograph should be the same kind of thing it was: a JPEG has
 * nowhere to put transparency, and a picture that never had any should not
 * acquire it on the way through.
 *
 * The encoder's settings travel on the path vips is told to write, and
 * nowhere else: what is checked afterwards is the file itself.
 */
function saveCopy(job, stamped, target, source) {
    const written = savingPath(target);

    runArgv(
        job.app,
        source.hasAlpha
            ? [job.tools.vips, "copy", stamped, written]
            : buildFlattenArgv(job.tools.vips, stamped, written),
        "saving the stamped copy"
    );
    verifyFileWritten(job.app, target, "the stamped copy");

    /*
     * A file with something in it is not a photograph. Asked of the copy
     * itself, through the reader that will have to open it: it is an image,
     * it can be read back, and it is the size of the one that was stamped.
     * The header is enough -- decoding every pixel of every copy would double
     * the run to catch a failure nothing has produced.
     */
    const saved = sizeOf(job, target);

    if (saved.width !== source.size.width || saved.height !== source.size.height) {
        throw new Error(
            `The stamped copy is ${saved.width} by ${saved.height} pixels ` +
                `where ${source.size.width} by ${source.size.height} were ` +
                `expected:\n\n${target}`
        );
    }
}

module.exports = { composite, saveCopy };
