"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("acorn");
const ROOT = path.resolve(__dirname, "../..");
const FIELDS = new Set(["issues", "recovery", "command", "outcome", "code", "cause"]);
const ERRORS = new Set(["Error", "IssueError", "OperationError", "UserCanceled"]);

function nodesOf(node) {
    const children = Object.values(node).flatMap((value) => Array.isArray(value) ? value : [value]);
    return [node, ...children.filter((value) => value && typeof value.type === "string").flatMap(nodesOf)];
}

function violations(source, core = false) {
    const nodes = nodesOf(parse(source, { ecmaVersion: 2022, sourceType: "script" }));
    const constructed = new Set(nodes.filter((node) => node.type === "VariableDeclarator" && node.init?.type === "NewExpression" && ERRORS.has(node.init.callee.name)).map((node) => node.id.name));
    return nodes.filter((node) =>
        (core && node.type === "NewExpression" && node.callee.name === "Error") ||
        (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" &&
            constructed.has(node.left.object.name) && FIELDS.has(node.left.computed ? node.left.property.value : node.left.property.name)));
}

test("issue-carrying errors receive their fields at construction", () => {
    assert.equal(violations('const refusal = new OperationError("stop"); refusal.issues = [];').length, 1);
    assert.equal(violations('const refusal = new OperationError("stop", { issues: [] });').length, 0);
    assert.equal(violations('throw new Error("fault");', true).length, 1);
    assert.equal(violations('const record = {}; record.issues = [];').length, 0);
    for (const entry of fs.readdirSync(path.join(ROOT, "src"), { recursive: true }).filter((file) => file.endsWith(".js"))) {
        assert.equal(violations(fs.readFileSync(path.join(ROOT, "src", entry), "utf8"), entry.startsWith(`core${path.sep}`)).length, 0, entry);
    }
});
