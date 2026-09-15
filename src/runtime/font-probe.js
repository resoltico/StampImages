"use strict";

const { buildTextArgv, fontDescription } = require("../core/lettering.js");
const { isUserCancelled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");
const { compareFiles, verifyFileWritten } = require("./asking.js");

/*
 * Whether this Mac will draw with a family, asked as two questions.
 *
 * Neither is sufficient alone, and both were measured rather than reasoned
 * about. fontconfig answers every name -- asked for one it does not have it
 * returns the family it would substitute -- so a name that comes back changed
 * is a name this Mac does not have, however well the substitute draws: "Noto
 * Serif" comes back as "Times New Roman" here, because macOS ships 190
 * script-specific Noto families and not that one. And a name fontconfig keeps
 * can still be one pango cannot render: Helvetica, Times, Hoefler Text and
 * Iowan Old Style all keep their names and all draw as the fallback, because
 * the files macOS keeps them in are not ones freetype will open.
 *
 * So a family is usable when fontconfig hands the name back unchanged and the
 * renderer draws something other than what it draws for a name nobody has.
 * Which names are worth suggesting is fonts.js.
 */

const IMPOSSIBLE = "NoSuchFaceIsInstalledAnywhere";
const PROBE_TEXT = "AWgy0123";
const PROBE_SIZE = 40;
const FAMILY_FORMAT = "%{family}";

function drawWith(where, family, output) {
    runArgv(
        where.app,
        buildTextArgv(
            where.tools.vips,
            output,
            PROBE_TEXT,
            fontDescription(family, "regular", PROBE_SIZE)
        ),
        "checking which fonts are installed"
    );
    verifyFileWritten(where.app, output, "the drawn text");

    return output;
}

/*
 * What a name that resolved to nothing looks like, drawn once: every family is
 * compared against it rather than against a guess. Not caught -- a renderer
 * that cannot draw a line of text is a broken tool, and saying so is a better
 * answer than reporting that this Mac has no fonts.
 */
function fallbackDrawing(where) {
    return drawWith(where, IMPOSSIBLE, `${where.workspace}/font-fallback.png`);
}

/*
 * The family fontconfig would use for this name, which is an identity rather
 * than a yes or no.
 *
 * Several names can come back for one family, because a face carries its
 * localized names too -- Hiragino Sans answers with four. Any of them is the
 * family that was asked for. A question that could not be put at all is not a
 * match either: nothing here may read silence as confirmation, and a
 * cancellation is let out by the caller rather than swallowed as a verdict.
 */
function keepsItsName(where, family) {
    const answered = String(runArgv(
        where.app,
        [where.tools["fc-match"], "-f", FAMILY_FORMAT, family],
        "checking which fonts are installed"
    ));
    const wanted = family.trim().toLowerCase();

    return answered.split(",").some((name) => name.trim().toLowerCase() === wanted);
}

/*
 * And whether the renderer draws with it. A comparison that could not be made
 * is not an answer: read as "these differ" it made an undrawable name into a
 * usable typeface, which is the one direction this must never fail in.
 */
function rasterises(where, family, fallback) {
    const drawn = drawWith(where, family, `${where.workspace}/font-candidate.png`);
    const answer = compareFiles(where.app, drawn, fallback);

    if (answer === "unreadable") {
        throw new Error("The drawings a typeface is checked by cannot be read.");
    }

    return answer === "differ";
}

/*
 * The reference is drawn once and every name compared against it, which is
 * why this is a factory: asking about ten names costs eleven drawings rather
 * than twenty. A cancellation is not a verdict about a typeface and is let
 * out; anything else the renderer says about one name is that name's answer.
 */
function probing(where) {
    const fallback = fallbackDrawing(where);

    return (family) => {
        try {
            return keepsItsName(where, family) &&
                rasterises(where, family, fallback);
        } catch (error) {
            if (isUserCancelled(error)) {
                throw error;
            }

            return false;
        }
    };
}

/*
 * Why a name was refused, in the one place every reader of it can reach.
 *
 * It names what was asked for rather than what is available, because what is
 * available is a handful of suggestions and the machine has hundreds -- and it
 * names the likeliest reason somebody is surprised. Measured: a font manager
 * activates a face through the system's own font machinery without putting a
 * file where these tools look, so Font Book, Word and every other app show it
 * while fontconfig has never heard of it. Reported from use, and the first
 * thing the message used to say was to set the weight elsewhere, which sent
 * somebody to try both weights of a face this cannot see at all.
 */
const WEIGHT_IN_NAME = /\s(?:Bold|Italic|Oblique)$/iu;

/*
 * Said only where it applies. A name ending in a weight word is the one shape
 * this can be sure about, because that is what an earlier version stored.
 */
function withoutTheWeight(family) {
    return WEIGHT_IN_NAME.test(family)
        ? ` The weight is a setting of its own: try "${
            family.replace(WEIGHT_IN_NAME, "")}" and set Weight.`
        : "";
}

function undrawable(family) {
    return `This Mac does not draw with the typeface "${family}".\n\n` +
        "Another app showing it is not the same as this being able to use " +
        "it: a font activated by a font manager rather than installed is not " +
        "where this looks. The settings window offers the faces it can " +
        `draw with.${withoutTheWeight(family)}`;
}

module.exports = { drawWith, probing, undrawable, IMPOSSIBLE, PROBE_SIZE };
