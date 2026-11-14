"use strict";
const assert = require("node:assert/strict");
const Ajv = require("ajv");
const schema = require("../receipt.schema.json");
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);

// Transport shape is independent of pixel, ownership and publication checks.
function assertReceipt(receipt) {
    assert.equal(validate(receipt), true, JSON.stringify(validate.errors));
}
function parseReceipt(text) {
    const receipt = JSON.parse(text);
    assertReceipt(receipt);
    return receipt;
}
module.exports = { assertReceipt, parseReceipt };
