"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    normalizeInvocationInput,
    isHeadlessInput,
    decodeFileUrl
} = require("../../../src/core/invocation.js");

test("headless is detected through osascript's argument separator", () => {
    // osascript forwards its own "--" into run(), so the script's first
    // argument is "--". Missing this sent the headless integration suite down
    // the interactive path, where it blocked on a GUI dialog forever.
    assert.equal(isHeadlessInput(["--", "--headless", "cfg.json", "a.png"]), true);
    assert.equal(isHeadlessInput(["--headless", "cfg.json", "a.png"]), true);
    assert.equal(isHeadlessInput(["--", "--", "--headless", "cfg.json"]), true);
});

test("non-headless invocations are left alone", () => {
    assert.equal(isHeadlessInput([]), false);
    assert.equal(isHeadlessInput(["--"]), false);
    assert.equal(isHeadlessInput(undefined), false);
    assert.equal(isHeadlessInput(null), false);
    assert.equal(isHeadlessInput(["/a/b.png"]), false);
    assert.equal(isHeadlessInput("/a/b.png"), false);
});

test("normalizeInvocationInput strips only leading separators", () => {
    assert.deepEqual(normalizeInvocationInput(undefined), []);
    assert.deepEqual(normalizeInvocationInput(null), []);
    assert.deepEqual(normalizeInvocationInput("/a.png"), ["/a.png"]);
    assert.deepEqual(
        normalizeInvocationInput(["--", "--headless", "c.json"]),
        ["--headless", "c.json"]
    );
    assert.deepEqual(
        normalizeInvocationInput(["/a.png", "--", "/b.png"]),
        ["/a.png", "--", "/b.png"],
        "a separator after a real argument is data, not syntax"
    );
});

test("decodeFileUrl converts Finder URLs to POSIX paths", () => {
    assert.equal(decodeFileUrl("file:///a/b%20c.png"), "/a/b c.png");
    assert.equal(decodeFileUrl("file://localhost/a/%C5%BDalioji.png"), "/a/Žalioji.png");
    assert.equal(decodeFileUrl("file:///a/b.png"), "/a/b.png");
});

test("a malformed escape is refused rather than guessed at", () => {
    // "%zz" is not an escape, and keeping the string undecoded gave two
    // different URLs one meaning: this one, and the correct encoding of a
    // file really called "%zz.png". The second names a real file, so the
    // first used to select a photograph nobody had asked for.
    assert.equal(decodeFileUrl("file:///a/%zz.png"), "");
    assert.equal(decodeFileUrl("file:///a/%25zz.png"), "/a/%zz.png");
});

test("a NUL is not a character a path can hold", () => {
    // It decodes without complaint and used to travel as far as the first
    // shell command, where it was reported as "not a readable file" -- true,
    // for the wrong reason.
    assert.equal(decodeFileUrl("file:///a/b%00c.png"), "");
});

test("a URL that names another host names nothing this can open", () => {
    // The authority is not part of the path. Stripping the prefix made
    // "remotehost/photos/a.jpg" -- a relative path, which the filesystem
    // answers against whatever the working directory happens to be.
    assert.equal(decodeFileUrl("file://remotehost/photos/a.jpg"), "");

    // And matching the longer prefix first made it worse rather than better.
    assert.equal(decodeFileUrl("file://localhostelsewhere/photos/a.jpg"), "");
});

test("a file URL with no path at all is not a path", () => {
    assert.equal(decodeFileUrl("file://localhost"), "");
    assert.equal(decodeFileUrl("file://"), "");
    assert.equal(decodeFileUrl(""), "");
});

test("only a file URL is decoded", () => {
    // Anything else is not this function's business: the caller asks whether
    // an item is a URL before it asks what the URL means, and a value that
    // reaches here and is not one has no path in it to find.
    assert.equal(decodeFileUrl("/already/posix.png"), "");
    assert.equal(decodeFileUrl("https://example.com/a.png"), "");
});

test("a name that contains file:// is not truncated", () => {
    // Only a prefix is a scheme. Unanchored, these patterns would cut the
    // name in half and leave a path that does not exist.
    assert.equal(
        decodeFileUrl("file:///a/see-file://localhost-here.png"),
        "/a/see-file://localhost-here.png"
    );
    assert.equal(decodeFileUrl("file:///a/file:/b.png"), "/a/file:/b.png");
});

test("the host form is stripped whole, not down to a slash", () => {
    // file://localhost/a/b.png and file:///a/b.png name the same file, and
    // the authority is read rather than trimmed: taking only "file://" off
    // the first would leave "localhost/a/b.png", a relative path.
    assert.equal(decodeFileUrl("file://localhost/a/b.png"), "/a/b.png");
    assert.equal(decodeFileUrl("FILE://LOCALHOST/a/b.png"), "/a/b.png");
    assert.equal(decodeFileUrl("File:///a/b.png"), "/a/b.png");
});

test("the caller's array is not modified while separators are stripped", () => {
    // run() is handed Finder's own array; shifting items out of it in place
    // would corrupt what the caller still holds.
    const original = ["--", "--headless", "/a/x.png"];
    const normalized = normalizeInvocationInput(original);

    assert.deepEqual(normalized, ["--headless", "/a/x.png"]);
    assert.deepEqual(
        original,
        ["--", "--headless", "/a/x.png"],
        "the input array must be left as it was"
    );
});

test("an empty selection is not a headless one", () => {
    // Nothing at all arrives as an empty list, and asking whether its first
    // item is the flag would be asking about a value that is not there.
    assert.equal(isHeadlessInput([]), false);
    assert.equal(isHeadlessInput(undefined), false);
    assert.equal(isHeadlessInput(null), false);
    assert.equal(isHeadlessInput(["--"]), false);
});

test("the separator is dropped only while it is the first thing there", () => {
    // osascript inserts it before the script's own arguments, and it can
    // arrive more than once; it is never something to convert.
    assert.deepEqual(normalizeInvocationInput(["--", "--", "/a/one.jpg"]), [
        "/a/one.jpg"
    ]);
    assert.deepEqual(normalizeInvocationInput(["/a/one.jpg", "--"]), [
        "/a/one.jpg",
        "--"
    ]);
    assert.deepEqual(normalizeInvocationInput(["--"]), []);
});
