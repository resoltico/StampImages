"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { showDetails } = require("../../../src/host/quick-action/details-dialog.js");
const { createFakeObjC } = require("../ports/fake-objc.cjs");

test("modal details reset once after visible layout and never fight later scrolling", () => {
    const bridge = createFakeObjC();
    bridge.state.duringModal = (alert) => {
        const [token] = bridge.state.observers;
        token.callback();
        assert.equal(alert.layoutPasses, 1, "hidden updates do not consume initialization");
        alert.window.visible = true;
        token.callback();
        assert.equal(alert.layoutPasses, 2);
        assert.deepEqual(bridge.state.observers, [], "remove before reset can cause a reentrant update");
        alert.accessoryView.contentView.scrollToPoint({ left: 0, top: 34 });
        token.callback();
        assert.deepEqual(alert.accessoryView.scrolledTo, { left: 0, top: 34 });
    };
    showDetails({}, { title: "Details", summary: "Summary", detail: "Long content", buttons: ["OK"] }, bridge);
    assert.deepEqual(bridge.state.observers, []);
});

test("modal initializer faults unwind the modal and retain their original error", () => {
    const bridge = createFakeObjC();
    const failure = new TypeError("late layout failed");
    bridge.state.duringModal = (alert) => {
        alert.window.visible = true;
        alert.accessoryView.documentView.scrollRangeToVisible = () => { throw failure; };
        bridge.state.observers[0].callback();
    };
    assert.throws(() => showDetails({}, { title: "Details", detail: "text", buttons: ["OK"] }, bridge), (error) => error === failure);
    assert.equal(bridge.state.aborted, 1);
    assert.deepEqual(bridge.state.observers, []);
    const broken = createFakeObjC({ duringModal() { throw failure; } });
    assert.throws(() => showDetails({}, { title: "Details", detail: "text", buttons: ["OK"] }, broken), (error) => error === failure);
    assert.deepEqual(broken.state.observers, []);
});

test("an abort failure cannot throw across the native block or mask the layout fault", () => {
    const bridge = createFakeObjC({ abortFailure: new Error("abort failed") });
    const primary = new TypeError("layout failed");
    bridge.state.duringModal = (alert) => {
        alert.window.visible = true;
        alert.accessoryView.documentView.scrollRangeToVisible = () => { throw primary; };
        assert.doesNotThrow(() => bridge.state.observers[0].callback());
    };
    assert.throws(() => showDetails({}, { title: "Details", detail: "text", buttons: ["OK"] }, bridge), (error) => error === primary);
    assert.deepEqual(bridge.state.observers, []);
});

test("the visible getter cannot recursively enter the native notification boundary", () => {
    const bridge = createFakeObjC();
    let reads = 0;
    bridge.state.duringModal = (alert) => {
        const [token] = bridge.state.observers;
        Object.defineProperty(alert.window, "visible", { get() {
            reads += 1;
            assert.equal(reads, 1, "a second native getter is the unguarded recursion negative control");
            token.callback();
            return true;
        } });
        assert.doesNotThrow(() => token.callback());
        assert.equal(alert.layoutPasses, 2);
        token.callback();
        assert.equal(reads, 1);
    };
    showDetails({}, { title: "Details", detail: "text", buttons: ["OK"] }, bridge);
    assert.deepEqual(bridge.state.observers, []);
});

test("registration and teardown notifications cannot read native visibility", () => {
    const bridge = createFakeObjC();
    const center = bridge.ns.NSNotificationCenter.defaultCenter;
    const add = center.addObserverForNameObjectQueueUsingBlock;
    const remove = center.removeObserver;
    let reads = 0;
    center.addObserverForNameObjectQueueUsingBlock = (name, window, queue, callback) => {
        Object.defineProperty(window, "visible", { get() { reads += 1; throw new Error("must not query outside modal"); } });
        const token = add(name, window, queue, callback);
        callback();
        return token;
    };
    center.removeObserver = (token) => { token.callback(); remove(token); };
    assert.equal(showDetails({}, { title: "Details", detail: "text", buttons: ["OK"] }, bridge), 0);
    assert.equal(reads, 0);
    assert.equal(bridge.state.aborted, 0);
    assert.deepEqual(bridge.state.observers, []);
});
