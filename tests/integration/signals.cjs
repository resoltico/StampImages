"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { setTimeout } = require("node:timers");
const [script, config, source, work] = process.argv.slice(2);
const owned = new Map();
let activeChild = null;
const digest = (filename) => crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
const original = digest(source);

function ownerAt(directory) {
    try { return JSON.parse(fs.readFileSync(path.join(directory, "owner.json"), "utf8")); }
    catch { return null; }
}

async function registeredWorkspace(existing, stderr) {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
        for (const name of fs.readdirSync(os.tmpdir()).filter((entry) => !existing.has(entry) && /^StampImages\.[A-Za-z0-9]{10}$/u.test(entry))) {
            const directory = path.join(os.tmpdir(), name), owner = ownerAt(directory);
            if (owner?.pid === activeChild.pid) { owned.set(directory, owner); return; }
        }
        assert.equal(activeChild.exitCode, null, stderr());
        assert.equal(activeChild.signalCode, null, stderr());
        // Registration proves this valid CLI child owns work before delivery.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, 10); });
    }
    assert.fail(`The child registered no workspace: ${stderr()}`);
}

function checkImage(filename) {
    assert.ok(fs.existsSync(filename), filename);
    assert.equal(execFileSync("vipsheader", ["-f", "width", filename], { encoding: "utf8" }).trim(), "600");
    assert.equal(execFileSync("vipsheader", ["-f", "height", filename], { encoding: "utf8" }).trim(), "400");
    execFileSync("vips", ["avg", `${filename}[fail_on=warning]`], { stdio: "pipe" });
}

function noStackKeys(value) {
    if (!value || typeof value !== "object") { return; }
    for (const [key, nested] of Object.entries(value)) {
        assert.notEqual(key, "stack", "public receipts cannot expose exception stacks");
        noStackKeys(nested);
    }
}

function verifyResult(receipt, input, delivered) {
    noStackKeys(receipt);
    assert.equal(receipt.state, delivered.length ? "canceled" : "complete");
    const outputs = new Set();
    for (const image of receipt.images) {
        assert.equal(digest(image.source), original, "signal handling must preserve every source");
        if (image.state === "saved") { outputs.add(image.output); checkImage(image.output); }
        if (image.state === "recovered") { checkImage(image.recovery); }
    }
    if (delivered.length) {
        assert.ok(receipt.issues.some((issue) => issue.code === "canceled") || receipt.images.some((image) => image.issues.some((issue) => issue.code === "canceled")));
    }
    for (const name of fs.readdirSync(input)) {
        if (name.includes("_stamped")) { assert.ok(outputs.has(path.join(input, name)), "a requested output exists without a confirmed saved record"); }
    }
    console.log(JSON.stringify({ delivered, state: receipt.state, confirmedOutputs: outputs.size, integrityChecked: true }));
}

async function signalRun(delivered, index) {
    const input = path.join(work, String(index)); fs.mkdirSync(input, { recursive: true });
    const count = delivered.length ? 40 : 1;
    for (let image = 0; image < count; image += 1) { fs.copyFileSync(source, path.join(input, `${image}.png`)); }
    const existing = new Set(fs.readdirSync(os.tmpdir()));
    activeChild = spawn("/usr/bin/osascript", ["-l", "JavaScript", script, "--", "--headless", config, input]);
    let stderr = "", stdout = "";
    activeChild.stdout.setEncoding("utf8"); activeChild.stderr.setEncoding("utf8");
    activeChild.stdout.on("data", (text) => { stdout += text; }); activeChild.stderr.on("data", (text) => { stderr += text; });
    const ended = once(activeChild, "close");
    if (delivered.length) { await registeredWorkspace(existing, () => stderr); }
    for (const signal of delivered) { assert.equal(activeChild.kill(signal), true); }
    const [code, signal] = await ended;
    assert.equal(signal, null, stderr); assert.equal(code, delivered.length ? 1 : 0, `${stdout}\n${stderr}`);
    assert.doesNotMatch(stderr, /execution error|\(-2700\)|\n\s+at \w/u);
    verifyResult(JSON.parse(stdout), input, delivered);
}

async function main() {
    try {
        for (const [index, delivered] of [[], ["SIGINT"], ["SIGTERM"], ["SIGINT", "SIGTERM", "SIGINT"]].entries()) {
            // Each child runs the shipped artifact and real receipt/exit transport.
            // eslint-disable-next-line no-await-in-loop
            await signalRun(delivered, index);
        }
    } finally {
        if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
            const ended = once(activeChild, "close"); activeChild.kill("SIGKILL"); await ended;
        }
        for (const [directory, expected] of owned) {
            if (fs.existsSync(directory)) {
                assert.deepEqual(ownerAt(directory), expected, "cleanup authority remains the child-owned workspace");
                fs.rmSync(directory, { recursive: true });
            }
        }
    }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
