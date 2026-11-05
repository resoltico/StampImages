"use strict";
const { normalizeSettings } = require("../core/settings.js");
const { answersFromSettings } = require("./answers.js");
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
        return answersFromSettings(normalizeSettings({ ...held, customText: "" }), fonts);
    } catch { return undefined; }
}
module.exports = { DOMAIN, KEY, encode, rememberedAnswers };
