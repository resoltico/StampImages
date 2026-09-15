"use strict";

const { stampsNothing } = require("../core/settings.js");
const { createWorkspace, removeWorkspace } = require("./workspace.js");
const { createRenamer } = require("./exclusive-rename.js");
const { availableFonts, drawsWith } = require("./fonts.js");
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

function fontsFor(prepared, workspace, progress) {
    if (prepared.invocation.headless) {
        return [];
    }

    progress.phase("Checking which fonts are installed");

    return availableFonts(whereToDraw(prepared, workspace));
}

/*
 * A run only ever draws with a face it has drawn with.
 *
 * The form's list is the probe's own output, so a typeface chosen from it
 * needs no second opinion and gets none. A name that did not come from it has
 * had none at all -- and pango answers every name, so a headless
 * configuration asking for a face this Mac does not have was stamped in a
 * default face and reported as a complete success, which is the one thing the
 * form's list exists to prevent.
 *
 * Refused rather than repaired. Substituting a face nobody asked for is what
 * this is about, and choosing the substitute here rather than letting pango
 * choose it would be the same silence with better manners.
 */
function requireDrawableFont(where, family, fonts) {
    if (fonts.includes(family) || drawsWith(where, family)) {
        return;
    }

    throw new Error(
        `Nothing draws with the typeface "${family}" on this Mac.\n\n` +
            "Not every installed face answers to the name Font Book shows. " +
            "The settings window offers the ones this Mac does draw with."
    );
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
    const context = {
        count: prepared.selection.images.length,
        fonts: fontsFor(prepared, place.workspace, place.progress)
    };

    place.progress.pause();

    const settings = settingsFrom(prepared.app, prepared.invocation, context);

    requireDrawableFont(
        whereToDraw(prepared, place.workspace),
        settings.font,
        context.fonts
    );

    return jobFor(prepared, settings, place);
}

module.exports = { withWorkspace, assemble, settingsFrom, jobFor };
