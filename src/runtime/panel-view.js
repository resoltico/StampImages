"use strict";

const { APP_NAME } = require("../core/version.js");
const {
    PANEL_RECT,
    HEADLINE_RECT,
    DETAIL_RECT,
    TRACK_RECT,
    fillRect
} = require("./panel-geometry.js");
const {
    makePanel,
    makeContent,
    makeHeadline,
    makeDetail,
    makeBar
} = require("./panel-widgets.js");
const { setHidden } = require("./panel-window.js");

/*
 * The panel as an assembled thing: a window, two lines of text and a bar.
 *
 * Nothing here decides anything. What the lines say, when the window appears
 * and when it goes away is panel.js's.
 */

/*
 * The panel is the only place a person can be told how to stop the run, so it
 * says so where it cannot be missed and cannot be covered by a filename.
 */
const TITLE = `${APP_NAME} — hold ⌥ to stop`;

function build(ns) {
    const content = makeContent(ns, PANEL_RECT);
    const view = {
        panel: makePanel(ns, PANEL_RECT, TITLE),
        headline: makeHeadline(ns, HEADLINE_RECT),
        detail: makeDetail(ns, DETAIL_RECT),
        track: makeBar(ns, TRACK_RECT, ns.NSColor.separatorColor),
        // Added after the track so it draws over it.
        fill: makeBar(ns, fillRect(0, 0), ns.NSColor.controlAccentColor)
    };

    for (const part of [view.headline, view.detail, view.track, view.fill]) {
        content.addSubview(part);
    }

    // A bar drawn empty before the photographs have been counted says none of
    // a known quantity is done. What is true is that the quantity is not known.
    setHidden(view.track, true);
    setHidden(view.fill, true);
    view.panel.contentView = content;

    return view;
}

module.exports = { TITLE, build };
