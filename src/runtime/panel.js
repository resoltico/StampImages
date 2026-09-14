"use strict";

const { appkitBridge } = require("./appkit-bridge.js");
const { fillRect } = require("./panel-geometry.js");
const { build } = require("./panel-view.js");
const {
    allowWindows,
    optionHeld,
    paint,
    show,
    hide,
    closeWindow,
    setFrame,
    setHidden
} = require("./panel-window.js");

/*
 * A window that says what the run is doing, for the hosts that present nothing
 * of their own.
 *
 * The host's Progress object is displayed by Script Editor, by an applet and
 * by the system script menu. A Shortcut is none of those, and this action is
 * shipped as a Shortcut -- so the report that mattered most was the one going
 * to the surface nobody could see. This is the other surface, and the two are
 * written to together rather than one falling back to the other: they are
 * presented by different hosts, not by the same host twice.
 *
 * Nothing here asks for input and nothing here waits. What it costs is one
 * bounded run loop pump per report, and what it buys is the difference between
 * a tool that looks hung and a tool that says "3 of 20".
 */

/*
 * How long a run has to have been going before a window is worth putting up.
 *
 * Stamping two small photographs is over in less time than it takes to read
 * the panel, and flashing one up on the way past is worse than saying nothing.
 * There is no timer: the clock is read when a report arrives, which is the
 * only moment the answer is needed.
 */
const APPEARANCE_DELAY = 500;

function panelSink(view, ns, now, restore) {
    let total = 0;
    let armedAt = now();

    return {
        /*
         * Asked between photographs. Nothing else here is a question: this is
         * the one thing the panel is for besides saying what is happening.
         */
        stopped() {
            return optionHeld(ns);
        },

        start(units) {
            total = units;
            setHidden(view.track, false);
            setHidden(view.fill, false);
        },

        report(done, description, detail) {
            view.headline.stringValue = description;
            view.detail.stringValue = detail;
            setFrame(ns, view.fill, fillRect(done, total));

            if (now() - armedAt < APPEARANCE_DELAY) {
                return;
            }

            show(view.panel);
            paint(ns, view.panel);
        },

        // Out of the way of a question, and armed again: whatever happens
        // after the answer has its own reason to be worth a window.
        pause() {
            hide(view.panel);
            armedAt = now();
        },

        close() {
            hide(view.panel);
            closeWindow(view.panel);
            restore();
        }
    };
}

/*
 * Built before the policy is touched, so a host that cannot make a window
 * leaves this process exactly as it found it.
 */
function openPanel(bridge = appkitBridge(globalThis.ObjC, globalThis.$), now = Date.now) {
    if (!bridge) {
        return null;
    }

    try {
        const view = build(bridge.ns);

        return panelSink(view, bridge.ns, now, allowWindows(bridge.ns));
    } catch {
        // No window server, no AppKit, a host that refuses one of these
        // objects: the run says what it can elsewhere and stamps the same.
        return null;
    }
}

module.exports = { APPEARANCE_DELAY, panelSink, openPanel };
