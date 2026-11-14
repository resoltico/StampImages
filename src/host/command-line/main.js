"use strict";
const { createProgress } = require("../progress.js");
const { failedRun } = require("../../core/outcomes.js");
const { hostError } = require("../cancellation.js");
const { execute, application } = require("../main.js");
const { cliCommand, showCliCommand } = require("./cli.js");
const { reportHeadless } = require("./reporting.js");
const { commandLineInteraction } = require("./interaction.js");

function cliRequest(input) {
    try { return cliCommand(input); }
    catch (error) { return { kind: "failed", outcome: failedRun(hostError(error)) }; }
}

function cliOutcome(invocation) {
    const progress = createProgress([]);
    try {
        try {
            const interaction = commandLineInteraction(invocation, { progress });
            return execute(application(), invocation, { interaction });
        } finally { progress.close(); }
    } catch (caught) {
        const failed = failedRun(hostError(caught), caught?.outcome);
        if (!caught?.outcome) { failed.diagnostics.push(...progress.diagnostics); }
        return failed;
    }
}

function runCli(input) {
    const command = cliRequest(input);
    if (command.kind === "failed") { return reportHeadless(command.outcome); }
    return command.kind === "run" ? reportHeadless(cliOutcome(command.invocation)) : showCliCommand(command.kind);
}
module.exports = { runCli };
