"use strict";

const {
    noteFontDrawn,
    refusesComparison,
    readsFile,
    headerField
} = require("./fake-drawing.cjs");

/*
 * What the fake host answers when the runtime runs a command.
 *
 * Apart from the host itself because it is the half that models a machine --
 * which tools are installed, what the probes say, what the image tools report
 * -- while the host models the application that runs them.
 */

const DIRECTORY_TEST = /^'[^']*\/test' '-d' '(?<path>.*)'$/u;
const EXECUTABLE_TEST = /^'[^']*\/test' '-x' '(?<path>.*)'$/u;

/*
 * Nothing is a directory unless the test says so, which is what a filesystem
 * with no directories in it means. A stub that answered yes to every test
 * made every path a folder.
 */
function refusesDirectory(app, command) {
    const directory = DIRECTORY_TEST.exec(command);

    return Boolean(directory) &&
        !(app.directories ?? []).includes(directory.groups.path);
}

/*
 * Which tools are installed. Left unsaid, everything is: a test about
 * something else should not have to list the machine's contents. A test that
 * does say gets exactly what it named and nothing else, which is how a
 * machine missing one tool is told from a machine missing all of them.
 */
function refusesExecutable(app, command) {
    const found = EXECUTABLE_TEST.exec(command);

    return Boolean(found) &&
        app.installed !== undefined &&
        !app.installed.includes(found.groups.path);
}

function searchesPath(app, command) {
    const wanted = /command -v '(?<name>[^']+)'/u.exec(command);

    if (!wanted || app.installed === undefined) {
        return undefined;
    }

    return app.installed.find((path) => path.endsWith(`/${wanted.groups.name}`)) ?? "";
}

function cannedAnswer(app, command) {
    if (command.includes("command -v brew")) {
        return app.brew ?? "/opt/homebrew/bin/brew";
    }

    if (command.includes("nonexistent-stamp-images-preflight")) {
        return app.vipsProbe ?? "VipsForeignLoad: file does not exist";
    }

    /*
     * exiftool is probed positively, about its own executable, so a healthy
     * one answers with the JSON the adapter reads rather than with a
     * complaint. A fake that answered a complaint would be describing the
     * probe this program deliberately does not use.
     */
    if (command.includes("exiftool") && command.includes("-json")) {
        return app.exiftool ??
            '[{"SourceFile": "/opt/homebrew/bin/exiftool", "FileType": "perl5 script"}]';
    }

    return undefined;
}

function refuses(app, command) {
    return refusesDirectory(app, command) ||
        refusesExecutable(app, command) ||
        refusesComparison(app, command);
}

function answersFor(app, command) {
    noteFontDrawn(app, command);

    for (const answer of [
        searchesPath(app, command),
        readsFile(app, command),
        headerField(app, command),
        cannedAnswer(app, command)
    ]) {
        if (answer !== undefined) {
            return answer;
        }
    }

    return undefined;
}

module.exports = { refuses, answersFor };
