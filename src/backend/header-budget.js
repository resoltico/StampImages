"use strict";
const { utf8Length } = require("../core/utf8.js");
const { shellJoin } = require("../core/shell.js");
const COMMAND_BUDGET_BYTES = 24000;
function commandLengthOf(argv) { return utf8Length(shellJoin(argv)); }
module.exports = { commandLengthOf, COMMAND_BUDGET_BYTES };
