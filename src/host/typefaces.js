"use strict";
const { sameName } = require("../core/typeface.js");
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

// Mandatory descriptor keys match installed aliases without native fallback fonts.
function matching(bridge, name, key) {
    const { ns } = bridge;
    const attributes = ns.NSDictionary.dictionaryWithObjectForKey(ns(name), key);
    const descriptor = ns.NSFontDescriptor.fontDescriptorWithFontAttributes(attributes);
    const found = descriptor.matchingFontDescriptorsWithMandatoryKeys(ns.NSSet.setWithObject(key));
    return found && !found.isNil() ? found.js ?? [] : [];
}
function familyOf(bridge, families, descriptor) {
    const candidate = String(bridge.objc.unwrap(descriptor.objectForKey(bridge.ns.NSFontFamilyAttribute)));
    return families.find((each) => sameName(each, candidate)) ?? null;
}
function postScriptOf(bridge, descriptor) {
    return String(bridge.objc.unwrap(descriptor.objectForKey(bridge.ns.NSFontNameAttribute)));
}
function visibleAlias(bridge, families, name, matches) {
    if (matches.length !== 1) { return null; }
    const [selected] = matches;
    const postScript = postScriptOf(bridge, selected);
    if (sameName(name, postScript)) { return null; }
    const family = familyOf(bridge, families, selected);
    if (!family) { return null; }
    const { ns, objc } = bridge;
    const rows = ns.NSFontManager.sharedFontManager.availableMembersOfFontFamily(ns(family)).js ?? [];
    const row = rows.find((each) => String(objc.unwrap(each.js[POSTSCRIPT_NAME])) === postScript);
    return row ? { family, face: String(objc.unwrap(row.js[FACE_NAME])) } : null;
}
function localizedNamed(bridge, families, value) {
    const name = String(value).trim();
    if (name === "") { return null; }
    const visible = matching(bridge, name, bridge.ns.NSFontVisibleNameAttribute);
    if (visible.length > 0) { return visibleAlias(bridge, families, name, visible); }
    const members = matching(bridge, name, bridge.ns.NSFontFamilyAttribute);
    if (members.length === 0 || members.some((each) => sameName(name, postScriptOf(bridge, each)))) { return null; }
    const canonical = members.map((each) => familyOf(bridge, families, each));
    const [family] = canonical;
    return family && canonical.every((each) => each === family) ? { family, face: "" } : null;
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
        localizedNamed: (name) => localizedNamed(bridge, families, name),
        postScriptNamed: (name) => postScriptFrom(bridge, name),
        coverageOf: (typeface) => coverageFrom(bridge, typeface)
    };
}

module.exports = { catalog };
