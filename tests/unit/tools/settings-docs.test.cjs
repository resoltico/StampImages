"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ROWS = [
    "| `dateFormat` | Date/time format | values |",
    "| `coordinateFormat` | Coordinate format | values |",
    "| `customText` | Custom text | values |",
    "| `font` | Typeface | values |",
    "| `size` | Text size | values |",
    "| `textColor` | Text color | values |",
    "| `outlineWidth` | Outline | values |",
    "| `outlineColor` | Outline color | values |",
    "| `position` | Position | values |",
    "| `margin` | Margin | values |"
];
test("settings table checks accept schema order and reject renamed or reordered rows", async () => {
    const { checkSettingsTable } = await import("../../../tools/lint/settings-docs.mjs");
    const text = ROWS.join("\n");
    assert.doesNotThrow(() => checkSettingsTable("table.md", text));
    assert.throws(() => checkSettingsTable("table.md", text.replace("| `coordinateFormat` | Coordinate format |", "| `coordinateFormat` | Include GPS coordinates |")), /settings table must include/u);
    const reordered = [...ROWS];
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    assert.throws(() => checkSettingsTable("table.md", reordered.join("\n")), /table order must match/u);
});
