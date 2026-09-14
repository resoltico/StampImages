"use strict";

/*
 * Reaching AppKit: whether it is there at all, and the two things every caller
 * that gets there has to say.
 *
 * Both callers have somewhere else to go when it is not: the settings form
 * falls back to the stepwise dialogs and the progress panel to the host's own
 * object. Neither fails a run over a widget.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    appkitBridge,
    rectOf,
    perform
} = require("../../../src/runtime/appkit-bridge.js");

function objcThat(behaviour) {
    return { import: behaviour, unwrap: (value) => value };
}

test("a bridge that takes the framework is one to build widgets with", () => {
    const imported = [];
    const ns = { NSMakeRect: () => null };
    const objc = objcThat((name) => imported.push(name));
    const bridge = appkitBridge(objc, ns);

    assert.deepEqual(imported, ["AppKit"]);
    assert.equal(bridge.objc, objc);
    assert.equal(bridge.ns, ns);
});

test("a host with no bridge at all is no bridge", () => {
    assert.equal(appkitBridge(null, {}), null);
    assert.equal(appkitBridge(undefined, {}), null);
    assert.equal(appkitBridge({ import: () => null }, null), null);
    assert.equal(appkitBridge(undefined, undefined), null);
});

test("a bridge that will not take AppKit is not one either", () => {
    assert.equal(
        appkitBridge(objcThat(() => {
            throw new Error("no such framework");
        }), {}),
        null
    );
});

test("a rectangle is written as a person reads one, and handed over as one", () => {
    const ns = {
        NSMakeRect: (left, bottom, width, height) =>
            ({ left, bottom, width, height })
    };

    assert.deepEqual(
        rectOf(ns, { left: 18, bottom: 16, width: 384, height: 6 }),
        { left: 18, bottom: 16, width: 384, height: 6 }
    );
});

test("a zero-argument ObjC method is performed, not described", () => {
    // JXA invokes them on property access. Written with parentheses it would
    // call whatever the method returned.
    const calls = [];
    const target = {};

    Object.defineProperty(target, "close", { get: () => calls.push("close") });
    perform(target, "close");

    assert.deepEqual(calls, ["close"]);
});
