"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { readFile } = require("node:fs/promises");

function checkBanner(release) {
    assert.match(release, /^\/\*\n \* Stamp Images \d+\.\d+\.\d+\n/u);
    assert.match(release, /SPDX-License-Identifier: AGPL-3\.0-only/u);
    assert.match(release, /Corresponding Source: https:\/\/github\.com\/resoltico\/StampImages/u);
    assert.match(release, /Requires macOS 12\.3 or later/u);
}

test("artifact is standalone, scoped, licensed, deterministic, and current", async () => {
    const { renderRelease, artifactPath, manifestPath, digestOf, renderManifest } = await import("../../tools/release.mjs");
    const { parseScript, commentsIn } = await import("../../tools/javascript.mjs");
    const release = await renderRelease();
    checkBanner(release);
    const tree = parseScript(release, 2022);
    assert.ok(tree.body.some((node) => node.type === "FunctionDeclaration" && node.id.name === "run"));
    assert.equal(commentsIn(release, 2022).length, 1);
    assert.equal(await renderRelease(), release);
    assert.equal(await readFile(artifactPath, "utf8"), release);
    assert.equal(await readFile(manifestPath, "utf8"), renderManifest(digestOf(release)));
});
