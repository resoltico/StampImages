"use strict";

/*
 * Whether a run gets a panel at all.
 *
 * Every way this can fail -- no ObjC bridge, no AppKit, no window server, a
 * host that refuses one of the objects -- has to end as a run with no
 * progress rather than a run that fails. And it has to leave the process
 * exactly as it was found: the activation policy is the one thing here that
 * outlives the window.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { openPanel } = require("../../../src/runtime/panel.js");
const { OPTION_HELD } = require("../../../src/runtime/panel-window.js");
const { createFakeObjC } = require("./fake-objc.cjs");

const POLICY_ACCESSORY = 1;
const POLICY_PROHIBITED = 2;

test("a bridge that cannot be had is no panel", () => {
    assert.equal(openPanel(null), null);
});

test("a host that refuses an object is no panel, and no policy left changed", () => {
    // Built before the policy is touched, so a process that cannot make a
    // window is left exactly as it was found.
    const { ns, state } = createFakeObjC({ policy: POLICY_PROHIBITED });

    ns.NSPanel = {
        alloc: {
            get initWithContentRectStyleMaskBackingDefer() {
                throw new Error("no window server here");
            }
        }
    };

    assert.equal(openPanel({ objc: {}, ns }), null);
    assert.deepEqual(state.policies, []);
});

test("a host that can be reached is a panel, and may show a window", () => {
    const { ns, state } = createFakeObjC({ policy: POLICY_PROHIBITED });
    const sink = openPanel({ objc: {}, ns }, () => 0);

    assert.deepEqual(
        Object.keys(sink).sort(),
        ["close", "pause", "report", "start", "stopped"]
    );
    assert.deepEqual(
        state.policies,
        [POLICY_ACCESSORY],
        "raised only as far as it takes to order a window front"
    );

    sink.close();

    assert.equal(state.policies.at(-1), POLICY_PROHIBITED, "and put back");
});

test("a host that cannot reach AppKit gets no panel and no policy change", () => {
    // Built before the policy is touched, so a host that cannot make a window
    // is left exactly as it was found.
    assert.equal(openPanel(null), null);
    assert.equal(openPanel(undefined, () => 0), null);
});

test("the panel is the one surface that can be asked about stopping", () => {
    // A poll rather than a button: a button needs a target to send its action
    // to, an event to be delivered and a run loop to deliver it, and this
    // process has a bounded pump and no event handling at all.
    const { ns, state } = createFakeObjC();
    const sink = openPanel({ objc: {}, ns }, () => 0);

    assert.equal(sink.stopped(), false);

    state.modifiers = OPTION_HELD;
    assert.equal(sink.stopped(), true);
});

test("a host that cannot answer is a host where nothing was held", () => {
    const { ns } = createFakeObjC();

    delete ns.NSEvent;
    assert.equal(openPanel({ objc: {}, ns }, () => 0).stopped(), false);
});
