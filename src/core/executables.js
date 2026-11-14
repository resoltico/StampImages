"use strict";

/*
 * Declare every system binary at its absolute path; PATH lookup is unnecessary
 * and untrusted for these tools. host/tools.js locates exiftool, vips and
 * vipsheader at run time. Keeping executable names here makes additions to the
 * artifact's external command surface explicit and reviewable.
 */

const CMP = "/usr/bin/cmp";
const CP = "/bin/cp";
const PS = "/bin/ps";
const MKDIR = "/bin/mkdir";
const RM = "/bin/rm";
const RMDIR = "/bin/rmdir";
const TEST = "/bin/test";
const MKTEMP = "/usr/bin/mktemp";
const PRINTENV = "/usr/bin/printenv";

const EXECUTABLES = [
    CMP, CP, PS, MKDIR, RM, RMDIR, TEST, MKTEMP, PRINTENV
];

module.exports = {
    CMP,
    CP,
    PS,
    MKDIR,
    RM,
    RMDIR,
    TEST,
    MKTEMP,
    PRINTENV,
    EXECUTABLES
};
