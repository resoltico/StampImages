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
         * Asked at every report of what is about to happen, which is what
         * makes those reports the checkpoints.
         *
         * Two ways to arrive at the same answer. A surface can be asked --
         * the panel reads the modifier keys -- and a surface can say so by
         * throwing a cancellation at the report it was given, which is what
         * the host's own dialogs do. Neither is the other's fallback, and
         * both arrive through the same broadcast: a surface that cannot
         * answer has not said yes, and must not fail a run over it.
         *
         * It latches, because one of those two is a moment rather than a
         * state: somebody who held the key while a photograph was being
         * stamped and let go before it finished had asked to stop, and the
         * answer was no by the time anything asked.
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
