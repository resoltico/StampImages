"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { IssueError, OperationError, UserCanceled, causes, isUserCanceled, commandOf } = require("../../../src/core/errors.js");

test("typed errors retain constructor fields, including explicitly empty values", () => {
    const cause = new Error("native");
    const fields = { cause, issues: [], recovery: "", command: "", outcome: null, stack: "native stack" };
    for (const ErrorType of [IssueError, OperationError]) {
        const error = new ErrorType("message", fields);
        assert.equal(error.message, "message");
        for (const [field, value] of Object.entries(fields)) { assert.equal(error[field], value, field); }
        assert.ok(error instanceof IssueError);
    }
    const canceled = new UserCanceled(fields);
    for (const [field, value] of Object.entries(fields)) { assert.equal(canceled[field], value, field); }
    assert.ok(isUserCanceled(canceled));
    const plain = new IssueError("plain");
    for (const field of ["issues", "recovery", "command", "outcome"]) { assert.equal(Object.hasOwn(plain, field), false); }
    assert.match(plain.stack, /plain/u);
});

test("constructor fields remain accessible through wrapping without decorating errors", () => {
    const issues = [{ code: "canceled", stage: "publication" }];
    const outcome = { images: [] };
    const inner = new UserCanceled({ issues, recovery: "/kept", command: "argv", outcome });
    const outer = new IssueError("context", { cause: inner });
    assert.equal(isUserCanceled(outer), true);
    assert.equal(commandOf(outer), "argv");
    assert.equal(causes(outer)[1].issues, issues);
    assert.equal(causes(outer)[1].recovery, "/kept");
    assert.equal(causes(outer)[1].outcome, outcome);
    assert.ok(new OperationError("operation").stack);
    assert.ok(new UserCanceled().stack);
});
