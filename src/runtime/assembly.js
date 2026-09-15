"use strict";

const { stampsNothing } = require("../core/settings.js");
const { createWorkspace, removeWorkspace } = require("./workspace.js");
const { createRenamer } = require("./exclusive-rename.js");
const { availableFonts } = require("./fonts.js");
const { probing } = require("./font-probe.js");
const { settingsFor } = require("./settings-run.js");

/*
 * Everything a run needs before it can stamp anything, gathered in the order
 * the answers depend on each other: which faces this Mac has, then what the
 * person wants drawn with them, then the job that carries both.
 *
 * Separate from main.js because it is a different kind of decision. The order
 * of a run is the product; this is the machinery that order asks for.
 */

/*
 * The workspace outlives the run when it still holds a finished copy that
 * could not be published and could not be moved anywhere else: the message
 * that reported the failure sent the user to it, and removing it here would
 * delete the file that message is about.
 */
function withWorkspace(app, unpublished, use) {
    const workspace = createWorkspace(app);

    try {
        return use(workspace);
    } finally {
        if (unpublished.size === 0) {
            removeWorkspace(app, workspace);
        }
    }
}

/*
 * Which faces this Mac will actually render with, asked only when somebody is
 * going to be offered a choice of them. It is the longest thing a run does
 * before it says anything, because every candidate is drawn with rather than
 * looked up.
 */
function whereToDraw(prepared, workspace) {
    return { app: prepared.app, tools: prepared.tools, workspace };
}

function fontsFor(where, headless, progress) {
    if (headless) {
        return [];
    }

    progress.phase("Checking which fonts are installed");

    return availableFonts(where);
}

/*
 * Whether a face draws, asked once per name.
 *
 * The faces the form suggests were drawn with to find them, so they are
 * answered before anybody asks. A name that was typed, or that came from a
 * headless configuration, costs a drawing the first time it is seen and
 * nothing afterwards -- which is what lets the same question be asked wherever
 * it matters without anyone counting the renderings.
 *
 * It goes in the context beside the count and the suggestions because it is
 * the same sort of thing: what the front ends need in order to ask. Neither of
 * them can answer this one, and both of them have to.
 */
function fontProbe(where, offered) {
    const answered = new Map(offered.map((family) => [family, true]));
    const draws = probing(where);

    return (family) => {
        if (!answered.has(family)) {
            answered.set(family, draws(family));
        }

        return answered.get(family);
    };
}

function settingsFrom(app, invocation, context) {
    const settings = settingsFor(app, invocation, context);

    if (stampsNothing(settings)) {
        throw new Error(
            "This would stamp nothing.\n\nChoose a date or coordinate " +
                "format, or write some text of your own."
        );
    }

    return settings;
}

function jobFor(prepared, settings, place) {
    return {
        app: prepared.app,
        tools: prepared.tools,
        settings,
        workspace: place.workspace,
        // One drawing per distinct text and colour space, bounded.
        stamps: new Map(),
        // How many drawings this run has made, which names their files.
        drawn: 0,
        // The colour profiles this run has seen, one file each.
        profiles: [],
        // Finished copies this run has produced and not yet published.
        unpublished: place.unpublished,
        rename: createRenamer(globalThis.ObjC, globalThis.$),
        progress: place.progress
    };
}

/*
 * The job, and the two questions that have to be answered before there can be
 * one. The pause is between them and the asking: a panel at the floating
 * window level would otherwise sit over the form, and re-arming it means a run
 * quick enough to need no window still does not get one.
 */
function assemble(prepared, place) {
    const where = whereToDraw(prepared, place.workspace);
    const fonts = fontsFor(where, prepared.invocation.headless, place.progress);
    const context = {
        count: prepared.selection.images.length,
        fonts,
        draws: fontProbe(where, fonts)
    };

    place.progress.pause();

    const settings = settingsFrom(prepared.app, prepared.invocation, context);

    return jobFor(prepared, settings, place);
}

module.exports = { withWorkspace, assemble, settingsFrom, jobFor };
