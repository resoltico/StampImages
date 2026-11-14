"use strict";
const { collectInvocation } = require("./input.js");
const { chooseSettings } = require("./settings-form.js");
const { reportNoImages, reportResult } = require("./reporting.js");

function quickActionInteraction(app, progress) {
    return { progress, collect: (input) => collectInvocation(app, input),
        settings: (context) => chooseSettings(app, context),
        noImages: (rejected) => reportNoImages(app, rejected), present: (result) => reportResult(app, result) };
}
module.exports = { quickActionInteraction };
