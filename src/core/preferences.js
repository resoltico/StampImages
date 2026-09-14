"use strict";

const { isSettingsRecord, normalizeSettings } = require("./settings.js");
const { answersFromSettings } = require("./answers.js");
const { defaultSettings } = require("./form-defaults.js");

/*
 * What a run remembers of the last one, and what it makes of finding it.
 *
 * Nine answers, kept as one record under one key, because two keys can be
 * written by two runs at once and leave one run's typeface beside another's
 * colour. One record cannot: the last run to confirm its settings is the one
 * whose settings are there.
 *
 * The version is in the name of the key rather than in the record. A record
 * this version cannot read is one it must not overwrite either, and checking
 * a number inside the record cannot stop that: by the time the number is read
 * the run is already pointed at the key it is about to write. Naming the key
 * for the version means an older copy of this action -- and people keep more
 * than one pasted about -- cannot reach what a newer one wrote, because it
 * asks for a different key. A later version can still read this one's and
 * bring it forward, which is more than a number in the record ever offered.
 *
 * The record holds settings rather than answers -- what the pipeline stores,
 * not what a control was showing. A label is display text that renaming a
 * preset would change, and a file written last month should not depend on
 * this month's wording.
 *
 * What comes back is not trusted. It has been on disk, where anything can
 * edit it, so it goes through the same validation as a headless
 * configuration -- the same function, not a second one that agrees with it
 * today. Anything unreadable, unrecognised or out of range is no answer at
 * all, and the run opens on the compiled defaults exactly as it always did.
 *
 */

const DOMAIN = "com.resoltico.StampImages";
const KEY = "lastSettings.v1";

// What a run is about, rather than how it should look.
const PER_JOB = ["customText"];

function encode(settings) {
    const kept = { ...settings };

    for (const key of PER_JOB) {
        delete kept[key];
    }

    return JSON.stringify(kept);
}

/*
 * The answers a remembered run would have given, or nothing at all. One
 * function because the runtime has one question -- what should the form open
 * on -- and every way of failing to answer it has the same reply: the
 * compiled defaults, which is what the form shows when it is passed nothing.
 */
// Nothing per-job was kept, so nothing per-job comes back.
function blank() {
    return { customText: "" };
}

function rememberedAnswers(text, fonts) {
    try {
        const held = JSON.parse(String(text));

        if (!isSettingsRecord(held)) {
            return undefined;
        }

        const settings = normalizeSettings({ ...defaultSettings(fonts), ...held });

        return { ...answersFromSettings(settings, fonts), ...blank() };
    } catch {
        return undefined;
    }
}

module.exports = { DOMAIN, KEY, encode, rememberedAnswers };
