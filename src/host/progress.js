"use strict";
const { broadcast } = require("./broadcast.js");
const { imageProgress } = require("./image-progress.js");

/*
 * One image is one unit. The image loop closes its unit on every outcome,
 * including failure. image-progress.js announces stages and checks pending
 * stops before work; surfaces adapt those reports to displays. Reports about
 * completed work must not undo confirmed publication.
 */

function nothing() {
    return undefined;
}

function never() {
    return false;
}

/*
 * Reports that go nowhere: a headless run, and a host with nothing at all to
 * report to.
 */
const SILENT = Object.freeze({
    stopped: never,
    expect: nothing,
    beginning: nothing,
    phase: nothing,
    finished: nothing,
    pause: nothing,
    summary: nothing,
    diagnostics: [],
    close: nothing
});

function lifecycle(state, each) {
    return {
        /*
         * Latch a stop whether a surface reports it directly or raises cancellation
         * while receiving a report. Surface faults remain diagnostics, not permission
         * to stop. Keep a transient key or button request latched until a safe checkpoint
         * consumes it, even if the user releases the control during an image stage.
         */
        stopped() {
            each((sink) => {
                state.stopped ||= sink.stopped?.() ?? false;
            });

            return state.stopped;
        },

        /*
         * The second half of this object's life. It is alive before the
         * photographs have been counted, because finding them is itself worth
         * saying, and it has no total until they have been.
         */
        requestStop() { state.stopped = true; },
        summary(settings) { each((sink) => sink.summary?.(settings)); },
        expect(images) {
            state.images = images;
            each((sink) => sink.start(images));
        },

        pause() {
            each((sink) => sink.pause());
        },

        close() {
            if (state.closed) {
                return;
            }

            state.closed = true;
            each((sink) => sink.close());
        }
    };
}

function createProgress(sinks) {

    const state =
        { images: 0, done: 0, description: "", detail: "", stopped: false, closed: false, diagnostics: [] };
    const each = broadcast(sinks, state);
    const say = () => each(
        (sink) => sink.report(state.done, state.description, state.detail)
    );
    const life = lifecycle(state, each);

    return { ...imageProgress(state, say, life.stopped), ...life, diagnostics: state.diagnostics };
}

module.exports = { createProgress, SILENT };
