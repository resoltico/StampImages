"use strict";

/*
 * A fake JXA host with a small in-memory filesystem.
 *
 * The runtime reaches the filesystem only through /bin/test, /bin/mv,
 * /bin/cp, /usr/bin/stat and /bin/rm, and produces files only through vips
 * and exiftool. Modelling those
 * few commands is enough to drive the publication logic — including the
 * non-clobbering move, which a stateless stub cannot exercise.
 */

const { createFilesystem } = require("./fake-filesystem.cjs");
const { injectedAnswer, dialogSurface } = require("./fake-answering.cjs");
const {
    parseArgv,
    dispatch,
    TEMPORARY
} = require("./fake-commands.cjs");

const WORKSPACE = `${TEMPORARY}/StampImages.Fake01`;

/*
 * A healthy machine by default: the tools are installed where Homebrew puts
 * them. A test that wants a missing tool overrides `executables`.
 */
const INSTALLED_TOOLS = [
    "/opt/homebrew/bin/vips",
    "/opt/homebrew/bin/vipsheader",
    "/opt/homebrew/bin/exiftool"
];

/*
 * The vips probe deliberately names a file that cannot exist; a healthy build
 * answers about the file, not about the flags. A test can override `preflight`
 * to stand in for an outdated tool, or `brew` for a machine without Homebrew.
 *
 * exiftool is not here. It is probed about its own executable and has to
 * answer with the JSON this program reads, which the filesystem below does --
 * a fake that answered that probe from a table would be proving nothing about
 * the shape the adapter parses.
 */
function setupAnswer(host, command) {
    if (command.includes("nonexistent-stamp-images-preflight")) {
        return host.preflight ?? "VipsForeignLoad: file does not exist";
    }

    if (command.includes("command -v brew")) {
        return host.brew ?? "/opt/homebrew/bin/brew";
    }

    return undefined;
}

/*
 * What renamex_np with RENAME_EXCL does: move the file, refusing a
 * destination that is there. A test gives the host a different one to stand
 * for a filesystem that cannot do it at all.
 */
function renamerOn(fs) {
    return { renamer: { rename: (from, to) => fs.exclusiveRename(from, to) } };
}

function filesystemFor(settings) {
    return createFilesystem(
        settings.files ?? [],
        settings.executables ?? INSTALLED_TOOLS,
        settings.emptyFiles ?? [],
        {
            directories: settings.directories ?? [],
            danglingLinks: settings.danglingLinks ?? [],
            metadata: settings.metadata ?? [],
            texts: settings.texts ?? [],
            fonts: settings.fonts,
            profiles: settings.profiles ?? []
        }
    );
}

// What vipsheader answers about a file. Left unsaid, an ordinary photograph.
function measurements(settings) {
    return {
        bands: settings.bands ?? 3,
        width: settings.width,
        height: settings.height,
        stampWidth: settings.stampWidth,
        stampHeight: settings.stampHeight,
        // The finished copy, which answers the photograph's own size unless a
        // test says otherwise: that is what a copy is.
        savedWidth: settings.savedWidth,
        savedHeight: settings.savedHeight,
        orientation: settings.orientation,
        stored: settings.stored,
        pages: settings.pages
    };
}

function createFakeHost(settings = {}) {
    const fs = filesystemFor(settings);
    const failures = settings.failures ?? [];
    const host = {
        files: fs.files,
        sizes: fs.sizes,
        metadata: fs.metadata,
        commands: [],
        dialogs: [],
        listPrompts: [],
        ...measurements(settings),
        includeStandardAdditions: false,

        doShellScript(command) {
            host.commands.push(command);

            const answered = setupAnswer(host, command);

            if (answered !== undefined) {
                return answered;
            }

            const injected = injectedAnswer(failures, command);

            if (injected !== undefined) {
                if (injected instanceof Error) {
                    throw injected;
                }

                return injected;
            }

            return dispatch(fs, parseArgv(command), command, host);
        }
    };

    return Object.assign(host, dialogSurface(host), renamerOn(fs));
}

module.exports = { createFakeHost, parseArgv, WORKSPACE };
