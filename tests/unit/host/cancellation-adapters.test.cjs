"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { OperationError, UserCanceled, isUserCanceled } = require("../../../src/core/errors.js");
const { hostError } = require("../../../src/host/cancellation.js");
const { runArgv, runArgvInto, tryArgv, cleanupArgv } = require("../../../src/host/shell.js");
const { succeeds, isRegularNonEmpty, sameBytes, isExecutable, isRegularFile, pathIsTaken } = require("../../../src/host/asking.js");
const { chooseRequired, askUntil } = require("../../../src/host/prompts.js");
const { showDetails } = require("../../../src/host/details-dialog.js");
const { collectDialogSettings } = require("../../../src/host/dialogs.js");
const { defaultAnswers } = require("../../../src/host/quick-action/settings-model.js");
const { findTool } = require("../../../src/host/tools.js");
const { checkTools } = require("../../../src/host/preflight.js");
const { createWorkspace, reclaimWorkspaces } = require("../../../src/host/workspace.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");

function rawCancel() { return Object.assign(new Error("native stop"), { errorNumber: -128 }); }
function canceledAt(use) {
    const raw = rawCancel();
    const stop = () => { throw raw; };
    assert.throws(() => use(stop), (error) => isUserCanceled(error) && error.cause === raw);
}

test("host translation preserves typed fields and translates raw nested cancellation only", () => {
    const raw = rawCancel();
    const wrapped = new Error("outer", { cause: raw });
    assert.equal(hostError(wrapped).cause, wrapped);
    assert.ok(isUserCanceled(hostError({ errorNumber: -128 })));
    const typed = new UserCanceled({ cause: raw, recovery: "/kept", issues: [{ code: "canceled" }] });
    assert.equal(hostError(typed), typed);
    assert.equal(hostError(new Error("ordinary")).message, "ordinary");
    assert.equal(hostError(null), null);
    assert.equal(hostError({ errorNumber: -1 }).errorNumber, -1);
});

test("shell command, redirection and optional-command adapters translate native stop", () => {
    for (const use of [
        (app) => runArgv(app, ["command"]),
        (app) => runArgvInto(app, ["command"], "/output"),
        (app) => tryArgv(app, ["command"])
    ]) { canceledAt((stop) => use({ doShellScript: stop })); }
    const raw = rawCancel();
    const result = cleanupArgv({ doShellScript: () => { throw raw; } }, ["command"]);
    assert.equal(result.state, "failed");
    assert.equal(result.issue.code, "canceled");
    assert.equal(result.issue.stage, "cleanup");
});

test("filesystem questions preserve stop instead of answering no", () => {
    for (const use of [
        (app) => succeeds(app, ["question"]),
        (app) => isRegularNonEmpty(app, "/file"),
        (app) => sameBytes(app, "/a", "/b"),
        (app) => isExecutable(app, "/file"),
        (app) => isRegularFile(app, "/file"),
        (app) => pathIsTaken(app, "/file")
    ]) { canceledAt((stop) => use({ doShellScript: stop })); }
});

test("list, input and detail-dialog adapters translate native stop", () => {
    canceledAt((stop) => chooseRequired({ chooseFromList: stop }, { choices: [{ label: "One", value: 1 }] }, "One"));
    canceledAt((stop) => askUntil({ displayDialog: stop }, { prompt: "Text", defaultAnswer: "" }, String));
    canceledAt((stop) => showDetails({ displayDialog: stop }, { title: "Details", detail: "Text", buttons: ["OK", "Cancel"] }, null));
});

test("empty-stamp corrective dialog translates native stop without another question", () => {
    canceledAt((stop) => {
        const app = {
            chooseFromList: (choices, options) => options.defaultItems,
            displayDialog: (message, options) => options.defaultAnswer === undefined
                ? stop() : { buttonReturned: "OK", textReturned: options.defaultAnswer }
        };
        return collectDialogSettings(app, { ...defaultAnswers(["Menlo"]), dateFormat: "Do not stamp the date" }, askingContext(["Menlo"], 1));
    });
});

test("tool path search translates stop after ordinary missing candidates", () => {
    canceledAt((stop) => findTool({ doShellScript(command) {
        if (command.includes("printenv")) { return ""; }
        if (command.includes("command -v")) { return stop(); }
        throw new Error("not found");
    } }, "vips"));
});

test("capability probe and Homebrew probe translate native stop", () => {
    canceledAt((stop) => {
        const app = createFakeApp();
        const normal = app.doShellScript;
        app.doShellScript = (command) => command.includes("nonexistent-stamp-images-preflight") ? stop() : normal(command);
        return checkTools(app);
    });
    canceledAt((stop) => {
        const app = createFakeApp({ installed: [] });
        const normal = app.doShellScript;
        app.doShellScript = (command) => command.includes("command -v brew") ? stop() : normal(command);
        return checkTools(app);
    });
});

test("workspace process query cleans a new workspace and preserves stop", () => {
    canceledAt((stop) => {
        const removed = [];
        const app = { doShellScript(command) {
            if (command.includes("mktemp")) { return "/tmp/StampImages.owned"; }
            if (command.includes("'/bin/rm'")) { removed.push(command); return ""; }
            assert.match(command, /ps/u);
            return stop();
        } };
        try { return createWorkspace(app, { pid: 12 }); }
        finally { assert.equal(removed.length, 1); }
    });
    canceledAt((stop) => reclaimWorkspaces({ doShellScript: stop }, { temporary: "/tmp", entries: () => ["StampImages.0123456789"] }));
});


test("stale workspace removal retains its canceled cleanup issue and stops reclamation", () => {
    const raw = rawCancel();
    const inspected = [];
    const storage = {
        temporary: "/tmp",
        entries: (target) => {
            inspected.push(target);
            return target === "/tmp" ? ["StampImages.0123456789", "StampImages.9876543210"] : ["owner.json"];
        },
        read: () => JSON.stringify({ pid: 99, started: "old process" })
    };
    const app = { doShellScript(command) {
        if (command.includes("'/bin/rm'")) { throw raw; }
        return "";
    } };
    assert.throws(() => reclaimWorkspaces(app, storage), (error) => isUserCanceled(error) && error.issues[0].code === "canceled" && error.issues[0].stage === "cleanup");
    assert.deepEqual(inspected, ["/tmp", "/tmp/StampImages.0123456789"]);
});

test("optional metadata cannot mistake cancellation for an absent field", () => {
    const { inspectCaptured } = require("../../../src/host/source-inspection.js");
    const missing = 'vips_image_get: field "orientation" not found';
    const header = "width: 10\nheight: 10\nbands: 3\nvips-loader: jpegload\ninterpretation: srgb\norientation: 1";
    for (const stop of [Object.assign(new Error(missing), { errorNumber: -128 }), new OperationError(missing, { cause: new UserCanceled() })]) {
        const app = { doShellScript(command) {
            if (command.includes("'-f'")) { throw stop; }
            return header;
        } };
        assert.throws(() => inspectCaptured({ app, tools: { vipsheader: "header" }, sources: {} }, { path: "/owned" }, "/original"), isUserCanceled);
    }
});
