"use strict";

const { buildCompositeArgv } = require("../core/commands.js");
const { runArgv, removeFile } = require("./shell.js");
const { verifyFileWritten } = require("./asking.js");
const { drawLayers } = require("./layers.js");

/*
 * Drawing the stamp: a small image with a transparent background, to be
 * composited onto a photograph.
 *
 * It is drawn once per distinct inscription rather than once per photograph.
 * Within one run the appearance cannot change, so two photographs taken in
 * the same minute in the same place want the same stamp.
 *
 * The text is drawn as a coverage mask -- one band saying how much of each
 * pixel the glyphs cover -- which is what makes the colour a separate
 * decision. The same mask, grown by a maximum filter, is the outline. Colour
 * is a solid image with a mask for its alpha, so a glyph's edge keeps the
 * softness the renderer gave it instead of being cut to a hard shape.
 */

function combineLayers(job, token, layers) {
    if (!layers.outline) {
        return layers.glyphs;
    }

    const path = `${job.workspace}/stamp-${token}.png`;

    runArgv(
        job.app,
        buildCompositeArgv(
            job.tools.vips,
            { base: layers.outline, overlay: layers.glyphs },
            path
        ),
        "assembling the stamp"
    );

    return path;
}

/*
 * Everything the drawing was made from, now that it is one file. A batch of
 * photographs taken over an hour has a distinct stamp for nearly every one of
 * them, so the parts of the last one are not something to keep.
 */
function clearLayers(job, layers, stamp) {
    for (const spent of layers.spent.filter((each) => each !== stamp)) {
        removeFile(job.app, spent);
    }
}

function drawStamp(job, token, drawn) {
    const layers = drawLayers(job, token, drawn);
    const path = combineLayers(job, token, layers);

    verifyFileWritten(job.app, path, "the stamp");
    clearLayers(job, layers, path);

    return { path, size: layers.size, moved: layers.moved };
}

/*
 * How many drawings a run keeps.
 *
 * The cache is for photographs that say the same thing, which is a burst
 * taken in one minute in one place -- a handful, adjacent. A run of a
 * thousand photographs across an afternoon says a thousand different things,
 * and keeping every drawing would leave a thousand files in the workspace to
 * serve a hit rate of nothing.
 */
const DRAWINGS_KEPT = 8;

function forget(job) {
    const [oldest] = job.stamps.keys();

    removeFile(job.app, job.stamps.get(oldest).path);
    job.stamps.delete(oldest);
}

/*
 * One drawing per distinct inscription -- and per colour space, because the
 * same words painted for a Display P3 photograph are different numbers from
 * the same words painted for an sRGB one. A batch comes off one camera, so
 * in practice that is still one drawing per inscription.
 */
function stampFor(job, drawn) {
    const key = `${drawn.profile}\n${drawn.text}`;
    const held = job.stamps.get(key);

    if (held) {
        return held;
    }

    const stamp = drawStamp(job, String(job.drawn += 1), drawn);

    if (job.stamps.size >= DRAWINGS_KEPT) {
        forget(job);
    }

    job.stamps.set(key, stamp);

    return stamp;
}

module.exports = { stampFor };
