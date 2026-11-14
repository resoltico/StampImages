"use strict";
const { validateSettings } = require("../core/settings.js");
const { answersFromSettings } = require("./quick-action/settings-model.js");
const DOMAIN = "com.resoltico.StampImages";
const KEY = "lastSettings";
function encode(settings) {
    const appearance = { ...settings };
    delete appearance.customText;
    delete appearance.typeface;
    return JSON.stringify(appearance);
}
function rememberedAnswers(text, fonts) {
    try {
        const held = JSON.parse(String(text));
        if (!held || typeof held !== "object" || Array.isArray(held) || Object.hasOwn(held, "customText")) { return undefined; }
        const result = validateSettings({ ...held, customText: "" });
        return result.settings ? answersFromSettings(result.settings, fonts) : undefined;
    } catch { return undefined; }
}
module.exports = { DOMAIN, KEY, encode, rememberedAnswers };
