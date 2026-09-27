#!/usr/bin/env bash
# Real native checkbox/binding, accessibility and geometry. No modal or image preview feature.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
WORK=$(mktemp -d -t StampImages-form)
trap 'rm -rf "$WORK"' EXIT
PREVIEWS=${STAMP_FORM_PREVIEWS:-"$WORK/previews"}
mkdir -p "$PREVIEWS"
cat "$ROOT/dist/Stamp-Images.jxa" > "$WORK/form.jxa"
cat >> "$WORK/form.jxa" <<'JXA'

const SMALLEST_VISIBLE_HEIGHT = 744;

function assertNativeStamp(condition, message) {
    if (!condition) { throw new Error(message); }
}

function measureStampForm(built, spec) {
    for (const row of spec.rows) {
        const entry = built.controls[row.key];
        const control = row.optional ? entry.popup : entry.text ?? entry;
        assertNativeStamp(ObjC.unwrap(control.accessibilityLabel) === row.label,
            `${row.key}: missing accessible name`);
        if (row.hint) {
            assertNativeStamp(ObjC.unwrap(control.accessibilityHelp) === row.hint,
                `${row.key}: missing accessible constraint`);
        }
        if (row.kind === "choice") {
            const opening = control.titleOfSelectedItem;
            for (let index = 0; index < Number(control.numberOfItems); index += 1) {
                control.selectItemAtIndex(index);
                assertNativeStamp(control.cell.cellSize.width <= control.frame.size.width,
                    `${row.key}: clipped choice ${ObjC.unwrap(control.titleOfSelectedItem)}`);
            }
            control.selectItemWithTitle(opening);
        }
    }
    const children = built.view.subviews;
    for (let index = 0; index < Number(children.count); index += 1) {
        const child = children.objectAtIndex(index);
        if ((child.isKindOfClass($.NSTextField) && !child.editable) ||
            child.isKindOfClass($.NSButton)) {
            assertNativeStamp(child.cell.cellSize.width <= child.frame.size.width,
                `Clipped native label or control at index ${index}`);
        }
    }
}

function checkStampToggle(bridge, spec, built) {
    const { toggle, popup } = built.controls.coordinateFormat;
    const off = "Do not stamp the coordinates";
    assertNativeStamp(Number(toggle.state) === 0 && !popup.enabled, "GPS must start off");
    assertNativeStamp(ObjC.unwrap(toggle.accessibilityLabel) === "Include GPS coordinates",
        "checkbox has no accessible name");
    assertNativeStamp(ObjC.unwrap(toggle.accessibilityHelp).includes("does not remove location data"),
        "checkbox has no metadata warning");
    toggle.performClick(toggle);
    assertNativeStamp(Number(toggle.state) === 1 && popup.enabled, "On did not enable format");
    popup.selectItemAtIndex(1);
    const chosen = String(ObjC.unwrap(popup.titleOfSelectedItem));
    assertNativeStamp(readControls(bridge, spec, built.controls).coordinateFormat === chosen,
        "enabled format was not read");
    toggle.performClick(toggle);
    assertNativeStamp(!popup.enabled && readControls(bridge, spec, built.controls).coordinateFormat === off,
        "Off did not disable the format or suppress its value");
    toggle.performClick(toggle);
    assertNativeStamp(popup.enabled && String(ObjC.unwrap(popup.titleOfSelectedItem)) === chosen,
        "switching off/on forgot the format");
    toggle.performClick(toggle);
}

function stampFormSnapshot(folder, scenario, appearance) {
    const bridge = { objc: ObjC, ns: $ };
    const spec = formSpec(scenario.answers, scenario.problems, scenario.context);
    const built = buildForm(bridge, spec, WIDGETS);
    const alert = WIDGETS.makeAlert($, spec);
    try {
        alert.accessoryView = built.view;
        alert.window.appearance = $.NSAppearance.appearanceNamed(appearance);
        alert.layout;
        measureStampForm(built, spec);
        if (scenario.name === "date-only") { checkStampToggle(bridge, spec, built); }
        const content = alert.window.contentView;
        content.layoutSubtreeIfNeeded;
        // Against the smallest screen a supported Mac has, not the screen this
        // runs on: a CI runner's virtual display is smaller than any Mac's.
        // 1366 x 768 is the 11-inch MacBook Air of early 2015, which macOS 12
        // supports; the menu bar leaves 744 points.
        const height = Number(alert.window.frame.size.height);
        assertNativeStamp(height <= SMALLEST_VISIBLE_HEIGHT,
            `${scenario.name}: the form is ${height} points tall, more than ${SMALLEST_VISIBLE_HEIGHT}`);
        const bitmap = content.bitmapImageRepForCachingDisplayInRect(content.bounds);
        content.cacheDisplayInRectToBitmapImageRep(content.bounds, bitmap);
        const png = bitmap.representationUsingTypeProperties(4, $.NSDictionary.dictionary);
        const path = `${folder}/${scenario.name}-${appearance}.png`;
        assertNativeStamp(png.writeToFileAtomically(path, true), `Could not write ${path}`);
        console.log(`Native stamp form checked: ${path}`);
    } finally {
        unbindChoices(spec, built.controls);
        alert.window.close;
    }
}

run = function(input) {
    ObjC.import("AppKit");
    $.NSApplication.sharedApplication;
    const fonts = ["Menlo", "Helvetica Neue Bold"];
    const answers = defaultAnswers(fonts);
    const context = { count: 1, fonts };
    const invalid = { ...answers, size: "0", margin: "bad" };
    const scenarios = [
        { name: "date-only", answers, problems: [], context },
        { name: "coordinates", answers: { ...answers, coordinateFormat: "56.9496, 24.1052" },
            problems: [], context: { ...context, count: 12 } },
        { name: "folders", answers, problems: [], context: { ...context, count: 231, selectedFolders: 2 } },
        { name: "corrections", answers: invalid, problems: readAnswers(invalid, fonts).problems, context },
        { name: "caption-only", answers: { ...answers, dateFormat: "Do not stamp the date", customText: "A caption\nAnother line" },
            problems: [], context }
    ];
    for (const symbol of ["NSAppearanceNameAqua", "NSAppearanceNameDarkAqua"]) {
        const appearance = ObjC.unwrap($[symbol]);
        for (const scenario of scenarios) { stampFormSnapshot(String(input[0]), scenario, appearance); }
    }
    return "macOS native stamp form integration passed";
};
JXA
osascript -l JavaScript "$WORK/form.jxa" "$PREVIEWS"
