"use strict";

/*
 * The exact argument vectors that draw the shape of the letters: the glyphs
 * as a coverage mask, the room the outline needs, and the outline itself.
 *
 * A mask says how much of each pixel a glyph covers and nothing about what
 * colour it is, which is what lets one drawing serve both the text and its
 * outline. Giving it a colour is colouring.js.
 *
 * Pure, so every flag the renderer receives is asserted by a test rather than
 * discovered on somebody's photographs. Nothing here runs anything.
 */

/*
 * The text, rendered to a coverage mask: one band saying how much of each
 * pixel the glyphs cover. A mask is what makes the colour a separate
 * decision, so the same rendering serves the text and its outline.
 *
 * The DPI is fixed and the size travels in the font string, which is how
 * pango names a size: at 72 DPI a point is a pixel, so a size asked for in
 * points is the size it comes out.
 */
const RENDER_DPI = "72";

// Either side of the pixel itself, which is what a width means for an outline.
const BOTH_SIDES = 2;

/*
 * What vips reads is not the text: it is pango markup.
 *
 * Measured, and it is not an edge case. "Mum & Dad" is refused outright --
 * `text: invalid markup in text`, no file written, that photograph failed --
 * and "<b>x</b>" is silently drawn in bold. Somebody typing a caption is
 * typing a caption, so the three characters markup reserves are written as
 * the entities that mean themselves.
 *
 * Here rather than anywhere earlier, because this is the one place text
 * becomes a command. Escaping at the edge would be a rule to remember;
 * escaping where the argument is built is a rule that cannot be forgotten.
 *
 * Only those three. The quote and the apostrophe are content characters in
 * markup, and a coordinate written 56 degrees 56 minutes is full of them.
 */
const MARKUP = [["&", "&amp;"], ["<", "&lt;"], [">", "&gt;"]];

function asMarkup(text) {
    return MARKUP.reduce(
        (written, [character, entity]) => written.split(character).join(entity),
        String(text)
    );
}

/*
 * The description the renderer is given, built rather than typed.
 *
 * Pango reads "Family Style Size" and takes the words before the size as
 * style instructions, so "Times New Roman 40" asks for the family "Times New"
 * at normal weight and "Arial Black 40" asks for Arial at weight 900. Both
 * measured. A comma ends the family, so "Times New Roman, 40" asks for the
 * family somebody actually named -- which is why the setting is a family name
 * and the weight is a setting of its own.
 *
 * Nothing here escapes the family: a comma inside it would end the name early,
 * and a name with a comma in it is not a family fontconfig will match anyway.
 * What guards the value is the resolver, which refuses a name this Mac does
 * not have before any of it is drawn.
 */
const WEIGHT_WORDS = { regular: "", bold: "Bold " };

function fontDescription(family, weight, size) {
    return `${family}, ${WEIGHT_WORDS[weight]}${size}`;
}

function buildTextArgv(vipsPath, outputPath, text, font) {
    return [
        vipsPath,
        "text",
        outputPath,
        asMarkup(text),
        "--font",
        font,
        "--dpi",
        RENDER_DPI
    ];
}

/*
 * Room for the outline to grow into.
 *
 * vips rank keeps its input's dimensions -- documented, and measured: a mask
 * dilated by four pixels came back the same size with the growth cut off at
 * every edge, so every stamp this program drew had its outline shaved flat
 * against the glyphs. The mask is embedded in a border first, and the border
 * is what the outline grows into.
 *
 * The glyphs are embedded in the same border rather than only the copy that
 * is dilated, because the two are composited on top of each other and two
 * images of different sizes do not line up.
 */
function buildEmbedArgv(vipsPath, around, size, border) {
    return [
        vipsPath,
        "embed",
        around.input,
        around.output,
        String(border),
        String(border),
        String(size.width + border * BOTH_SIDES),
        String(size.height + border * BOTH_SIDES),
        "--background",
        "0"
    ];
}

/*
 * The outline is the same mask grown by a few pixels: a maximum filter over a
 * square window, which is what dilation is. The window is the width either
 * side plus the pixel itself, and the index selects the largest of them.
 */
function windowFor(outlineWidth) {
    return outlineWidth * BOTH_SIDES + 1;
}

function buildDilateArgv(vipsPath, inputPath, outputPath, outlineWidth) {
    const size = windowFor(outlineWidth);

    return [
        vipsPath,
        "rank",
        inputPath,
        outputPath,
        String(size),
        String(size),
        String(size * size - 1)
    ];
}

module.exports = {
    fontDescription,
    asMarkup,
    buildTextArgv,
    buildEmbedArgv,
    buildDilateArgv,
    windowFor
};
