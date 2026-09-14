"use strict";

const { broadcast } = require("./broadcast.js");
const { reporting } = require("./saying.js");

/*
 * Saying what the run is doing while it does it: how much there is, how much
 * is done, and the one object every surface is reported to. What is said about
 * the photograph in hand is saying.js, and where any of it is displayed is
 * surfaces.js.
 *
 * One photograph is one unit of work, so there is one number rather than two.
 * The sibling this was taken from had a mode that published a single document
 * out of every image, and there the units and the images were different counts
 * -- carrying that distinction here would be carrying an answer to a question
 * this product does not ask.
 *
 * Two rules hold the rest of it up. The loop that owns a photograph closes
 * its unit, and nothing else counts -- publication used to be the only thing
 * that advanced it in the sibling, so a run whose second image failed ended at
 * 2 of 3, and one where all three failed ended at 0 of 3. And a report of what
 * is about to happen may stop the run, while a report of what has happened may
 * not: that is saying.js's rule, and this is where the answer it asks for
 * comes from.
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
                state.stopped ||= sink.stopped();
            });

            return state.stopped;
        },

        /*
         * The second half of this object's life. It is alive before the
         * photographs have been counted, because finding them is itself worth
         * saying, and it has no total until they have been.
         */
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
    if (sinks.length === 0) {
        return SILENT;
    }

    const state =
        { images: 0, done: 0, description: "", detail: "", stopped: false, closed: false };
    const each = broadcast(sinks, state);
    const say = () => each(
        (sink) => sink.report(state.done, state.description, state.detail)
    );
    const life = lifecycle(state, each);

    return { ...reporting(state, say, life.stopped), ...life };
}

module.exports = { createProgress, SILENT };
