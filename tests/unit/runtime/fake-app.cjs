"use strict";

/*
 * A stand-in for the JavaScript for Automation host application.
 *
 * The runtime modules take `app` as a parameter rather than reaching for a
 * global, so the whole macOS layer can be driven from Node with this.
 */

const { answersFor, refuses } = require("./fake-shell.cjs");

/*
 * `responses` maps a substring of the command to either a string to return or
 * an Error to throw. The first matching entry wins; anything unmatched returns
 * the empty string, which is what a successful silent command produces.
 */
/*
 * vipsheader answers several different questions, so a matcher keyed on the
 * tool name alone would answer them all with the band count. The preflight probes name
 * a file that cannot exist and expect an answer about the file.
 */
/*
 * A list of answers is given in order, which is how a prompt that asks again
 * after a bad entry can be driven. Only a dialog that offers a text field
 * takes one: a message with an OK button asks nothing and consumes nothing.
 * An Error in the list is raised where the real dialog raises on Cancel.
 */
function answerFor(app, options) {
    if (!options || options.defaultAnswer === undefined) {
        return "";
    }

    if (!Array.isArray(app.nextAnswer)) {
        // Nothing arranged is somebody pressing Return, which is the answer
        // already in the box. A stub that answered undefined instead made
        // every re-asking prompt loop forever.
        return app.nextAnswer ?? options.defaultAnswer;
    }

    if (app.nextAnswer.length === 0) {
        throw new Error("the test did not say what to answer this time");
    }

    return app.nextAnswer.shift();
}

function dialogSurface(app) {
    return {
        displayDialog(message, options) {
            app.dialogs.push({ message, options });

            const answer = answerFor(app, options);

            if (answer instanceof Error) {
                throw answer;
            }

            return { textReturned: answer ?? "" };
        },

        chooseFromList(options, settings) {
            app.listPrompts.push({ options, settings });

            return app.nextChoice === undefined
                ? [options[0]]
                : app.nextChoice;
        }
    };
}

function createFakeApp(responses = []) {
    const app = {
        commands: [],
        dialogs: [],
        listPrompts: [],
        includeStandardAdditions: false,

        doShellScript(command) {
            app.commands.push(command);

            for (const [needle, result] of responses) {
                if (command.includes(needle)) {
                    if (result instanceof Error) {
                        throw result;
                    }

                    return result;
                }
            }

            if (refuses(app, command)) {
                throw new Error("test failed");
            }

            return answersFor(app, command) ?? "";
        }
    };

    return Object.assign(app, dialogSurface(app));
}

function failing(message) {
    return new Error(message);
}

module.exports = { createFakeApp, failing };
