"use strict";

/*
 * What a test has arranged the fake host to say: an answer instead of running
 * a command, and what comes back from a dialog.
 */

/*
 * What a test has arranged to happen instead. A function answers differently
 * as the run goes on, which is how a name becomes occupied while a copy is
 * still being made.
 */
function injectedAnswer(failures, command) {
    for (const [needle, result] of failures) {
        if (command.includes(needle)) {
            return typeof result === "function" ? result(command) : result;
        }
    }

    return undefined;
}

function dialogSurface(host) {
    return {
        displayDialog(message, options) {
            host.dialogs.push({ message, options });

            return { textReturned: host.nextAnswer ?? options.defaultAnswer ?? "" };
        },

        chooseFromList(choices) {
            host.listPrompts.push(choices);

            return host.nextChoice === undefined
                ? [choices[0]]
                : host.nextChoice;
        }
    };
}

module.exports = { injectedAnswer, dialogSurface };
