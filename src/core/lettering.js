"use strict";

/*
 * The exact argument vectors that draw the shape of the letters: the glyphs
 * as a coverage mask, and the description of the face that shapes them.
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
 * family somebody actually named -- which is why the two halves of a typeface
 * are kept apart and joined here, with the comma between them.
 *
 * The face goes where pango reads style words, and the style words pango reads
 * are the ones the font system uses: measured, "Avenir, Black 40" draws Avenir
 * Black and "Source Serif 4, Semibold 40" draws that named instance. A family
 * with no face named is its own default one.
 *
 * A typeface that could not be split is written without the comma, and pango
 * splits it instead -- which is worse and is the point: measured, "Helvetica
 * Neue Bold, 40" draws nothing but the fallback face, because there is no
 * family by that name, while "Helvetica Neue Bold 40" draws the face asked
 * for. That shape is what a host with no font catalogue falls back to.
 *
 * Nothing here escapes either half: a comma inside a family would end the name
 * early, and no family or face on this Mac contains one -- measured across all
 * 217 families. What guards the values is typeface.js, which refuses a name
 * the machine does not have before any of it is drawn.
 */
function fontDescription(typeface, size) {
    return typeface.family
        ? `${typeface.family}, ${typeface.face ? `${typeface.face} ` : ""}${size}`
        : `${typeface.name} ${size}`;
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

module.exports = { fontDescription, asMarkup, buildTextArgv };
