"use strict";
/*
 * Probe AppKit independently of form or panel construction. Unavailable forms
 * can use scripting-addition dialogs; progress surfaces are optional and an
 * unavailable panel must not fail the run. Sharing this capability probe avoids
 * a dependency from progress UI onto the settings form.
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
 * JXA invokes zero-argument Objective-C methods through property access.
 * Name that operation explicitly so callers do not use bare expressions.
 */
function perform(target, method) {
    return target[method];
}

const MODAL_UNAVAILABLE = -1001;

module.exports = { MODAL_UNAVAILABLE, appkitBridge, rectOf, perform };
