"use strict";

/*
 * Reaching AppKit: whether it is there at all, and the two things every caller
 * that gets there has to say.
 *
 * A bridge that will not take the framework is one that cannot draw anything,
 * and every caller has somewhere else to go: the settings form falls back to
 * the stepwise dialogs, and the progress panel falls back to reporting through
 * the host's own Progress object. Neither fails a run over a widget.
 *
 * This is where the form and the panel meet, and the only place they do. A
 * progress panel that had to import the settings form to ask whether AppKit
 * exists would be pointing its dependency at the wrong thing.
 */

function appkitBridge(objc, ns) {
    if (!objc || !ns) {
        return null;
    }

    try {
        objc.import("AppKit");

        return { objc, ns };
    } catch {
        return null;
    }
}

/*
 * Every rectangle in this program is written down the way a person reads one
 * -- where its left edge is, where its bottom edge is, how wide and how tall
 * -- and turned into AppKit's own at the moment it is handed over.
 */
function rectOf(ns, rect) {
    return ns.NSMakeRect(rect.left, rect.bottom, rect.width, rect.height);
}

/*
 * A zero-argument ObjC method, which JXA performs on property access. Named
 * once rather than written as a bare expression statement at each call, where
 * it reads as a mistake and has to be excused to the linter.
 */
function perform(target, method) {
    return target[method];
}

module.exports = { appkitBridge, rectOf, perform };
