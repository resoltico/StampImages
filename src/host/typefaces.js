"use strict";
const { appkitBridge } = require("./appkit-bridge.js");

/*
 * What faces this Mac has, asked of the font system that draws them.
 *
 * The renderer is pango through cairo, and on a Mac pango draws through
 * CoreText unless it is told otherwise. Measured: pangocairo links both
 * CoreText and fontconfig, and the two answer differently -- fontconfig lists
 * 671 families here of which the renderer draws 147, CoreText lists 217 of
 * which it draws 188, and neither list contains the other. Asking fontconfig
 * was asking a catalog the renderer was not reading from, which is how a
 * font every other app on this Mac could use was refused: a face switched on
 * by a font manager is in CoreText and not in fontconfig.
 *
 * So one font system answers, and it is the one that draws. What is asked here
 * is what will be drawn with.
 *
 * It answers about names, not about files. Measured: of the 217 families
 * CoreText lists, 7 are ones cairo cannot open -- Hoefler Text, Big Caslon,
 * Apple Chancery and four Indic faces, all of them old suitcase fonts -- and
 * those draw in the fallback face without saying so. Drawing with each one and
 * comparing was tried and is worse: the fallback face is Helvetica itself, so
 * that test can never approve Helvetica or Times, and it refused 442 of the
 * 589 families a person can see. A rare silent substitution beats refusing the
 * most ordinary names on the machine.
 */

/*
 * A family's faces, as the font system names them: Avenir answers Book, Roman,
 * Light, Medium, Heavy, Black and their obliques, and Source Serif 4 answers
 * the twelve named instances of a variable font. These are the names pango
 * takes as the style of a description, measured -- "Avenir, Black 40" draws
 * Avenir Black and "Source Serif 4, Semibold 40" draws that instance.
 *
 * Each row is a face described four ways, of which the second is the style.
 */
const POSTSCRIPT_NAME = 0;
const FACE_NAME = 1;
const PROBE_SIZE = 12;

function manager(bridge) {
    return bridge.ns.NSFontManager.sharedFontManager;
}

function familiesFrom(bridge) {
    return manager(bridge).availableFontFamilies.js.map((name) => String(name.js));
}

function facesFrom(bridge, family) {
    const rows = manager(bridge).availableMembersOfFontFamily(bridge.ns(family)).js;

    return (rows ?? []).map((row) => String(row.js[FACE_NAME].js));
}

/*
 * The family and face a PostScript name such as "HelveticaNeue-Bold" belongs
 * to, so a refusal can say the name this takes instead of claiming the Mac has
 * no such typeface. Asked only after a name has already been refused.
 */
function postScriptFrom(bridge, name) {
    const font = bridge.ns.NSFont.fontWithNameSize(bridge.ns(name), PROBE_SIZE);
    if (!font || font.isNil()) { return null; }
    const family = String(font.familyName.js);
    const rows = manager(bridge).availableMembersOfFontFamily(bridge.ns(family)).js ?? [];
    const row = rows.find((each) => String(each.js[POSTSCRIPT_NAME].js) === name);
    return row ? { family, face: String(row.js[FACE_NAME].js) } : null;
}

/*
 * Whether the chosen face has a glyph for a character. Pango draws a
 * character the face lacks in another face without saying so -- measured,
 * "abc" in Zapf Dingbats came out in a plain sans -- so the run asks the face
 * and can say so instead. Null when the face cannot be asked: nothing is then
 * claimed either way.
 */
function coverageFrom(bridge, typeface) {
    const rows = manager(bridge).availableMembersOfFontFamily(bridge.ns(typeface.family)).js ?? [];
    const row = typeface.face ? rows.find((each) => String(each.js[FACE_NAME].js) === typeface.face) : rows[0];
    const font = row ? bridge.ns.NSFont.fontWithNameSize(row.js[POSTSCRIPT_NAME], PROBE_SIZE) : null;
    if (!font || font.isNil()) { return null; }
    const covered = font.coveredCharacterSet;
    return (codePoint) => Boolean(covered.longCharacterIsMember(codePoint));
}

/*
 * One reading per run, and one per family asked about. The catalog cannot
 * change while a run is happening, and every question is a trip across the
 * bridge.
 *
 * Without a bridge there is no catalog at all, which is not the same as an
 * empty one: nothing may read that as "this Mac has no fonts". Callers are
 * given `null`; setup refuses to render when installed typefaces cannot be
 * verified.
 */
function catalog(bridge = appkitBridge(globalThis.ObjC, globalThis.$)) {
    if (!bridge) {
        return null;
    }

    const families = familiesFrom(bridge);
    const faces = new Map();

    return {
        families,
        facesOf(family) {
            if (!faces.has(family)) {
                faces.set(family, facesFrom(bridge, family));
            }

            return faces.get(family);
        },
        postScriptNamed: (name) => postScriptFrom(bridge, name),
        coverageOf: (typeface) => coverageFrom(bridge, typeface)
    };
}

module.exports = { catalog };
