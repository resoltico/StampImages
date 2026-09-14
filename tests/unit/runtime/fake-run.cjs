"use strict";

/*
 * A machine with photographs on it and a settings file beside them, which is
 * what a headless run is: the whole program, from the selection to the copy,
 * driven through the fake filesystem.
 */

const { createFakeHost } = require("./fake-host.cjs");

const SETTINGS_PATH = "/a/settings.json";

const SETTINGS = {
    font: "Menlo",
    size: 24,
    textColour: "#FFFFFF",
    outlineColour: "#202020",
    outlineWidth: 2,
    position: "bottom-right",
    margin: 16,
    dateFormat: "iso-minutes",
    coordinateFormat: "decimal",
    customText: "Riga"
};

const TAKEN = {
    DateTimeOriginal: "2026:09:09 14:30:05",
    GPSLatitude: 56.9496,
    GPSLongitude: 24.1052
};

/*
 * The photographs, the settings file, and what each photograph says about
 * itself. Anything a test wants to be different -- a tool missing, a command
 * refused -- goes through to the host underneath.
 */
function machineWith(photographs = ["/a/one.jpg"], overrides = {}) {
    const { settings = {}, facts = TAKEN, ...rest } = overrides;

    return createFakeHost({
        files: [...photographs, SETTINGS_PATH, ...rest.files ?? []],
        texts: [[SETTINGS_PATH, JSON.stringify({ ...SETTINGS, ...settings })]],
        metadata: photographs.map((path) => [path, facts]),
        ...rest
    });
}

function headlessArguments(photographs = ["/a/one.jpg"]) {
    return ["--headless", SETTINGS_PATH, ...photographs];
}

module.exports = { machineWith, headlessArguments, SETTINGS, SETTINGS_PATH, TAKEN };
