"use strict";
const { isCliInput } = require("./host/invocation-syntax.js");
const { runCli } = require("./host/command-line/main.js");
const { runQuickAction } = require("./host/quick-action/main.js");

// eslint-disable-next-line no-unused-vars -- The public Shortcuts bridge takes parameters.
function run(input, parameters) {
    return isCliInput(input) ? runCli(input) : runQuickAction(input);
}
module.exports = { run };
