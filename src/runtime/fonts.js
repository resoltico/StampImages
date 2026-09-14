"use strict";

const { buildTextArgv } = require("../core/lettering.js");
const { isUserCancelled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");
const { sameBytes, verifyFileWritten } = require("./asking.js");

/*
 * Which fonts this machine will actually render with.
 *
 * The renderer resolves a font name through pango, and pango answers every
 * name: asked for one it cannot place, it draws in a default face and says
 * nothing. A settings form offering a name that silently becomes a different
 * face is worse than one offering fewer names, so each family is drawn with
 * before it is offered, beside a name that certainly does not exist, and a
 * family whose drawing is that drawing did not resolve.
 *
 * The drawings are compared byte for byte. Comparing their widths was the
 * first attempt and it was wrong twice over: measured on this Mac, Georgia and
 * the unresolvable name both drew the probe 192 pixels wide, so a font that
 * was installed was dropped -- and a bold name that had fallen back drew 197
 * against the regular fallback's 192, so a font that was not installed was
 * offered. Two renderings of one font are byte-identical, measured; two
 * different faces at the same width are not.
 *
 * What this catches is not only a missing font. Measured with the fonts
 * present and listed by fontconfig: "Helvetica" and "Times New Roman" both
 * draw as the fallback, while Helvetica Neue, Arial, Georgia and the rest draw
 * as themselves. Whatever the reason -- pango reads a trailing "Roman" as a
 * style keyword, and the system's .ttc collections are their own story -- the
 * question worth asking is not "is this font installed" but "does asking for
 * it by this name draw it", and that is the question this asks.
 */

/*
 * Faces macOS ships, across the shapes somebody stamping a photograph might
 * want: a sans, a display sans, a serif, an old-style serif, and a monospace
 * for coordinates that line up. Names that do not draw are dropped by the
 * probe, so the list can afford to be optimistic; what it may not do is grow
 * without bound, because every name in it costs a rendering.
 */
const CANDIDATES = [
    "Helvetica Neue",
    "Arial",
    "Verdana",
    "Avenir Next",
    "Gill Sans",
    "Georgia",
    "Palatino",
    "Baskerville",
    "Menlo",
    "Courier New"
];

const IMPOSSIBLE = "NoSuchFaceIsInstalledAnywhere";
const PROBE_TEXT = "AWgy0123";
const PROBE_SIZE = 40;

/*
 * A family that draws is offered in both weights without probing the bold.
 *
 * The fallback is a fallback of the family: once the name has resolved, the
 * weight is chosen within the face pango found, so bold cannot become somebody
 * else's font. It can become a synthesised or nearest-weight bold, which is a
 * heavier version of what was asked for rather than a substitution -- and
 * probing for it would double the wait before the form appears.
 */
const WEIGHTS = ["", " Bold"];

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
 * The faces to offer, in the order they are written down. A machine none of
 * them draws on is not one this can offer a choice on, and it says so rather
 * than offering a list that does nothing.
 */
function availableFonts(where) {
    const fallback = fallbackDrawing(where);
    const found = [];

    for (const family of CANDIDATES) {
        if (resolves(where, family, fallback)) {
            found.push(...WEIGHTS.map((weight) => `${family}${weight}`));
        }
    }

    if (found.length === 0) {
        throw new Error(
            "None of the fonts this action offers draws on this Mac."
        );
    }

    return found;
}

module.exports = { availableFonts, CANDIDATES, IMPOSSIBLE };
