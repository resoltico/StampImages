"use strict";
const test = require("node:test");
test("both repository settings tables follow schema names and order", async () => {
    const { checkSettingsDocs } = await import("../../tools/lint/settings-docs.mjs");
    await checkSettingsDocs();
});
