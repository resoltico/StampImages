"use strict";

/*
 * Every way of ending up with nowhere to keep anything, and the one object
 * they all come back as.
 *
 * Not null: a caller given nothing has to remember to ask whether it got
 * something, at every place it uses it, and forgetting once put a null where
 * a set of answers belonged -- which the form could not read, so a machine
 * that merely could not save its settings was answering ten questions one at
 * a time instead.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createMemory } = require("../../../src/runtime/preferences.js");

test("a plain value has no isNil to answer, and is taken as present", () => {
    // Asked defensively: a wrapped Objective-C nil is a truthy object, and a
    // plain string is not one at all.
    const suite = new Map();
    const ns = (text) => text;

    ns.NSUserDefaults = {
        alloc: { initWithSuiteName: () => ({
            stringForKey: (key) => suite.get(key),
            setObjectForKey: (value, key) => suite.set(key, value)
        }) }
    };

    const memory = createMemory({ import: () => null, unwrap: (value) => value }, ns);

    memory.remember('{"size":48}');
    assert.equal(memory.recall(), '{"size":48}');
});

test("nothing there at all is nothing remembered", () => {
    const ns = (text) => text;

    ns.NSUserDefaults = {
        alloc: { initWithSuiteName: () => ({
            stringForKey: () => null,
            setObjectForKey: () => undefined
        }) }
    };

    assert.equal(
        createMemory({ import: () => null, unwrap: (value) => value }, ns).recall(),
        ""
    );
});

test("a bridge with one half missing is no bridge", () => {
    // Both are needed, so either one absent is the same answer.
    assert.equal(createMemory(null, {}).recall(), "");
    assert.equal(createMemory({ import: () => null }, null).recall(), "");
    assert.equal(createMemory(null, null).recall(), "");
});

test("being unable to remember is a way of behaving, not an absence", () => {
    // A caller given nothing has to remember to ask whether it got something,
    // at every place it uses it -- and forgetting once put a null where a set
    // of answers belonged.
    const nowhere = createMemory(null, null);

    assert.equal(nowhere.recall(), "");
    assert.equal(nowhere.remember("anything"), undefined);
    assert.equal(nowhere.recall(), "", "and it still remembers nothing");
});
