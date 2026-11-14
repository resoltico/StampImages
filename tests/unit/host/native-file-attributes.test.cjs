"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { attributeFailureKind, attributesAt } = require("../../../src/host/native-file-attributes.js");

test("filesystem absence requires a positive native error, not missing attributes", () => {
    const objc = { unwrap: (value) => value };
    const ns = { NSUnderlyingErrorKey: "underlying" };
    const nil = { isNil: () => true };
    const error = (domain, code, underlying = nil) => ({ domain, code, isNil: () => false,
        userInfo: { objectForKey(key) { assert.equal(key, "underlying"); return underlying; } } });
    for (const [domain, code, expected] of [["NSCocoaErrorDomain", 4, "missing"], ["NSCocoaErrorDomain", 260, "missing"],
        ["NSPOSIXErrorDomain", 2, "missing"], ["NSPOSIXErrorDomain", 20, "missing"],
        ["NSCocoaErrorDomain", 257, "unreadable"], ["NSPOSIXErrorDomain", 13, "unreadable"], ["NSPOSIXErrorDomain", 1, "unreadable"]]) {
        assert.equal(attributeFailureKind(objc, ns, error(domain, code)), expected);
    }
    assert.equal(attributeFailureKind(objc, ns, error("NSCocoaErrorDomain", 256, error("NSPOSIXErrorDomain", 20))), "missing");
    assert.equal(attributeFailureKind(objc, ns, error("unknown", 260)), "unexaminable");
    assert.equal(attributeFailureKind(objc, ns, error("NSCocoaErrorDomain", 256)), "unexaminable");
    assert.equal(attributeFailureKind(objc, ns, nil), "unexaminable");
    assert.equal(attributeFailureKind(objc, ns, null), "unexaminable");
});

test("a caller-owned NSError out object is passed to the native attribute query", () => {
    const failure = { output: true };
    const ns = (value) => value ?? { defaultOutput: true };
    const seen = [];
    assert.equal(attributesAt({ attributesOfItemAtPathError(...args) { seen.push(args); return { isNil: () => true }; } }, ns, "/path", failure), null);
    assert.deepEqual(seen, [["/path", failure]]);
});
