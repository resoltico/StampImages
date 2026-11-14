"use strict";
// The shared font catalog is the command line's only AppKit dependency.
function fontBridge(objc, ns) {
    if (!objc || !ns) { return null; }
    try { objc.import("AppKit"); return { objc, ns }; }
    catch { return null; }
}

/*
 * Query system family and style names through AppKit, matching the CoreText
 * font system used by the renderer. Fontconfig can expose a different catalog,
 * including different activated fonts.
 *
 * Catalog availability does not guarantee Cairo can open every suitcase font.
 * Comparing drawings to a fallback cannot establish availability when the
 * requested face is itself the fallback. Preserve the naming contract and
 * report glyph coverage separately from renderer substitution guarantees.
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
function catalog(bridge = fontBridge(globalThis.ObjC, globalThis.$)) {
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
