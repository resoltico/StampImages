"use strict";
function run(input) {
    ObjC.import("stdio");
    const RENAME_EXCL = 4;
    return $.renamex_np(String(input[0]), String(input[1]), RENAME_EXCL);
}
module.exports = { run };
