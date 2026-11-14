"use strict";
const { createProgress } = require("../progress.js");
const { openPanel } = require("./panel.js");
function openProgress(build = [openPanel]) {
    const progress = createProgress([]);
    const sinks = [];
    for (const open of build) {
        try { const sink = open(); if (sink) { sinks.push(sink); } }
        catch (error) { progress.diagnostics.push({ code: "observer-fault", message: String(error), stack: error?.stack ?? "" }); }
    }
    const live = createProgress(sinks);
    live.diagnostics.push(...progress.diagnostics);
    return live;
}
module.exports = { openProgress };
