"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { nativePublication, classify } = require("../../../src/host/native-publication.js");

for (const [code, state] of [[17,"exists"],[18,"cross-device"],[45,"unsupported"],[78,"unsupported"],[1,"denied"],[13,"denied"],[30,"denied"],[999,"unknown"]]) {
    test(`POSIX ${code} maps to ${state}`, () => assert.equal(classify(code,"NSPOSIXErrorDomain"),state));
}

test("unknown native domains are not guessed from English messages", () => {
    assert.equal(classify(17,"Other"),"unknown");
    assert.equal(classify(516,"NSCocoaErrorDomain"),"unknown");
});
test("missing native bridge has no weak fallback", () => {
    assert.equal(nativePublication(null,{}),null);
    assert.equal(nativePublication({},null),null);
});

function abiFixture(errno = 17) {
    const events = [];
    const ns = {
        NSFileManager: { defaultManager: {} },
        link: (from, to) => { events.push(["link", from, to]); return -1; },
        "renamex_np": (from, to, flags) => { events.push(["rename", from, to, flags]); return -1; },
        strerror: (code) => `native ${code}`,
        __error: () => { events.push("errno"); return [errno]; }
    };
    const port = nativePublication({ import:()=>true, bindFunction:()=>true, unwrap:(value)=>value }, ns);
    return { port, events, ns };
}

test("link and exclusive rename are C calls whose errno is read immediately", () => {
    // link(2), not NSFileManager: measured, linkItemAtPath wrote a precomposed
    // "rīga" as decomposed bytes, so the copy's name no longer matched its source.
    const { port, events, ns } = abiFixture();
    assert.equal(port.link("/a","/b").state,"exists");
    assert.equal(port.rename("/a","/b").state,"exists");
    assert.deepEqual(events,[["link","/a","/b"],"errno",["rename","/a","/b",4],"errno"]);
    Object.assign(ns, { link: () => 0, "renamex_np": () => 0 });
    assert.deepEqual(port.link("/a","/b"),{state:"created"});
    assert.deepEqual(port.rename("/a","/b"),{state:"created"});
    assert.equal(events.length, 4, "success reads no errno");
});

test("native imports and ABI bindings match the classified operations",()=>{
    const events=[];
    const ns={NSFileManager:{defaultManager:{}}};
    nativePublication({import:(name)=>events.push(name),bindFunction:(...args)=>events.push(args)},ns);
    assert.deepEqual(events,["Foundation","stdio",["__error",["int *",[]]],["strerror",["char *",["int"]]],["link",["int",["char *","char *"]]]]);
});

test("native diagnostics retain domain, numeric code and operation text",()=>{
    const {port}=abiFixture(13);
    assert.deepEqual(port.link("/a","/b"),{state:"denied",diagnostic:{code:13,domain:"NSPOSIXErrorDomain",message:"native 13"}});
    assert.deepEqual(port.rename("/a","/b").diagnostic,{code:13,domain:"NSPOSIXErrorDomain",message:"native 13"});
});
