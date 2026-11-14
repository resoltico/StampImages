"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { setAside } = require("../../../src/host/rescue.js");
const { createFakeHost } = require("../ports/fake-host.cjs");
const RECOVERY = "/var/folders/xx/T/StampImages-recovered.Fake01";

test("private recovery rechecks its immutable original immediately before copying", () => {
    const app = createFakeHost({ files: ["/work/a.pdf"] });
    const original = app.publication.facts("/work/a.pdf");
    const execute = app.doShellScript;
    let changed = false;
    app.doShellScript = (command) => { const result = execute(command); if (command.includes("mktemp")) { changed = true; } return result; };
    app.publication.facts = () => changed ? { identity: "1:99", size: original.size } : original;
    assert.throws(() => setAside(app, "/work/a.pdf", app.publication, { intendedName: "a.pdf", original }), (error) => error.recovery === null);
    assert.equal(app.commands.some((command) => command.includes("/bin/cp")), false);
    assert.ok(app.files.has("/work/a.pdf"));
});

test("same-size original replacement during CP preserves both paths and exposes the owned candidate", () => {
    const app = createFakeHost({ files: ["/work/a.pdf"] });
    const original = app.publication.facts("/work/a.pdf");
    const execute = app.doShellScript, read = app.publication.facts;
    let changed = false;
    app.doShellScript = (command) => { const result = execute(command); if (command.includes("/bin/cp")) { changed = true; } return result; };
    app.publication.facts = (path) => changed && path === "/work/a.pdf" ? { identity: "9:9", size: original.size } : read(path);
    assert.throws(() => setAside(app, "/work/a.pdf", app.publication, { intendedName: "a.pdf", original }), (error) => {
        assert.equal(error.recovery, null); assert.equal(error.issues[0].code, "fault");
        const { candidate } = error.issues[0].diagnostic;
        assert.equal(candidate.folder, `${RECOVERY}/`);
        assert.equal(candidate.identity, read(`${RECOVERY}/a.pdf`).identity);
        return true;
    });
    assert.ok(app.files.has("/work/a.pdf")); assert.ok(app.files.has(`${RECOVERY}/a.pdf`));
});


test("private recovery rechecks original ownership after successful name lookup before unlink", () => {
    const staged = "/work/a.pdf";
    const app = createFakeHost({ files: [staged] });
    const original = app.publication.facts(staged), read = app.publication.facts;
    let changed = false;
    app.publication.actualPath = (path) => { changed = true; return path; };
    app.publication.facts = (path) => changed && path === staged ? { identity: "9:9", size: original.size } : read(path);
    assert.throws(() => setAside(app, staged, app.publication, { intendedName: "a.pdf", original }), (error) => {
        assert.equal(error.recovery, null);
        assert.equal(error.issues[0].diagnostic.candidate.path, `${RECOVERY}/a.pdf`);
        return true;
    });
    assert.ok(app.files.has(staged)); assert.ok(app.files.has(`${RECOVERY}/a.pdf`));
});
