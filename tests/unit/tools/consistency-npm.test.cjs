"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
test("npm engine, exact package manager and mise pins agree", async () => {
    const { checkNpmVersion } = await import("../../../tools/lint/consistency.mjs");
    const read = (name) => name === "package.json" ? JSON.stringify({ packageManager: "npm@12.2.1", engines: { npm: ">=12.2.1" } }) : 'npm = "12.2.1"';
    assert.equal(await checkNpmVersion(read), "12.2.1");
    await assert.rejects(() => checkNpmVersion((name) => name === "mise.toml" ? 'npm = "12.1.0"' : read(name)), /npm versions disagree/u);
});
