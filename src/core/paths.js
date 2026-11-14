"use strict";

/*
 * Path string manipulation.
 *
 * These operate on POSIX path strings rather than touching the filesystem, so
 * they stay pure and testable.
 */

function basename(path) {
    const normalized = String(path).replace(/\/+$/u, "");
    const index = normalized.lastIndexOf("/");

    return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function dirname(path) {
    const text = String(path);
    const index = text.lastIndexOf("/");

    return index >= 0 ? text.slice(0, index + 1) : "";
}

function fileStem(filename) {
    const value = String(filename);
    const index = value.lastIndexOf(".");

    return index > 0 ? value.slice(0, index) : value;
}

/*
 * Reduces a name to something safe to create on disk while preserving
 * Unicode. Separators and control characters become underscores; the result
 * never starts or ends with whitespace, a dot, or an underscore.
 */
function sanitizeFilename(filename) {
    const safe = String(filename)
        // Control characters are matched on purpose: they must not reach a filename.
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f\x7f/:]/gu, "_")
        .replace(/_+/gu, "_")
        .replace(/^\.+|\.+$/gu, "")
        .replace(/^[\s_]+|[\s_]+$/gu, "");

    return safe.length > 0 ? safe : "image";
}

module.exports = {
    basename,
    dirname,
    fileStem,
    sanitizeFilename
};
