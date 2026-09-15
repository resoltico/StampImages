"use strict";

const { buildTextArgv } = require("../core/lettering.js");
const { isUserCancelled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");
const { sameBytes, verifyFileWritten } = require("./asking.js");

/*
 * Whether asking for a face by a given name draws that face.
 *
 * The renderer resolves a name through pango, and pango answers every name:
 * asked for one it cannot place, it draws in a default face and says nothing.
 * So the only way to find out is to draw with it, beside a name that certainly
 * does not exist, and compare.
 *
 * The drawings are compared byte for byte rather than by width, and what is
 * asked is "does asking for it by this name draw it" rather than "is it
 * installed": measured, "Helvetica" and "Times New Roman" are both present and
 * both draw as the fallback. What each of those cost to learn is in QA.md.
 *
 * Which names are worth suggesting is fonts.js. This is the question it and
 * everything else asks.
 */

const IMPOSSIBLE = "NoSuchFaceIsInstalledAnywhere";
const PROBE_TEXT = "AWgy0123";
const PROBE_SIZE = 40;

function drawWith(where, font, output) {
    const { app, tools } = where;

    runArgv(
        app,
        buildTextArgv(tools.vips, output, PROBE_TEXT, `${font} ${PROBE_SIZE}`),
        "checking which fonts are installed"
    );
    verifyFileWritten(app, output, "the drawn text");

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
 * A family that would not draw is one this Mac cannot offer, which is what
 * this is for -- and a cancellation is not that. The probe is the longest
 * thing a run does before it says anything, one vips render per candidate, so
 * it is where somebody waiting is most likely to ask it to stop; swallowed
 * here, that answered "this Mac does not have this font" about every
 * remaining one, and a run whose probe was stopped part way told the person
 * their Mac had no fonts at all.
 *
 * Nothing has been produced at this point -- no photograph has been read --
 * so letting it out costs nothing and ends the run where every other
 * cancellation ends it.
 */
function resolves(where, family, fallback) {
    try {
        const drawn = drawWith(
            where,
            family,
            `${where.workspace}/font-candidate.png`
        );

        return !sameBytes(where.app, drawn, fallback);
    } catch (error) {
        if (isUserCancelled(error)) {
            throw error;
        }

        return false;
    }
}

/*
 * The reference is drawn once and every name is compared against it, which is
 * the whole reason this is a factory rather than a function: asking about ten
 * names costs eleven renderings, not twenty. One caller asks about ten, to
 * find what the form should suggest; another asks about one at a time, as
 * names are typed or read out of a configuration.
 */
function probing(where) {
    const fallback = fallbackDrawing(where);

    return (family) => resolves(where, family, fallback);
}

/*
 * Why a name was refused, in the one place both readers of it can reach.
 *
 * It names what was asked for rather than what is available, because the list
 * of what is available is a handful of suggestions and the machine has
 * hundreds. The second sentence is there because Font Book is where somebody
 * will look, and it will show them the face they just typed: "Times New
 * Roman" is installed on this Mac, and asking for it by that name draws the
 * fallback.
 */
function undrawable(family) {
    return `Nothing draws with the typeface "${family}" on this Mac.\n\n` +
        "Not every installed face answers to the name Font Book shows.";
}

module.exports = { drawWith, probing, undrawable, IMPOSSIBLE };
