"use strict";

/*
 * Invocation parsing.
 *
 * osascript forwards its own "--" argument separator into run(), so the
 * script's first argument is "--" rather than the caller's first real
 * argument. Dropping leading separators makes both of these equivalent, which
 * is what lets the integration suite run unattended:
 *
 *     osascript -l JavaScript script.jxa -- --headless config.json image
 *     osascript -l JavaScript script.jxa    --headless config.json image
 */

const ARGUMENT_SEPARATOR = "--";

/*
 * Normalize nested Shortcuts input, such as [[file, file], parameters], into
 * individual items. Stringifying an array would join paths with commas and
 * could pass superficial path/extension checks while naming no actual file.
 * The trailing parameters object is left for path resolution to ignore.
 */
function normalizeInvocationInput(input) {
    if (input === undefined || input === null) {
        return [];
    }

    const items = (Array.isArray(input) ? input : [input]).flat(Infinity);

    while (items.length > 0 && String(items[0]) === ARGUMENT_SEPARATOR) {
        items.shift();
    }

    return items;
}

/*
 * Parse Finder file URLs as local absolute paths. Validate the complete
 * authority: stripping file:// or matching a localhost prefix could turn a
 * remote authority into a relative path. Return an empty path for unsupported
 * URLs so selection can report the original requested URL as a rejection.
 */
const FILE_URL = /^file:\/\/(?<authority>[^/]*)(?<path>\/.*)$/iu;
const LOCAL_HOST = "localhost";

function isLocalAuthority(authority) {
    return authority === "" || authority.toLowerCase() === LOCAL_HOST;
}

/*
 * Refuse malformed escapes and decoded NUL characters in file URLs. Keeping
 * an undecodable URL as a path could select a different file from the one
 * named. Unencoded spaces are accepted by decodeURIComponent; literal percent
 * characters in a filename must be encoded.
 */
const NUL = "\u0000";

function decodePath(path) {
    try {
        const decoded = decodeURIComponent(path);

        return decoded.includes(NUL) ? "" : decoded;
    } catch {
        return "";
    }
}

function decodeFileUrl(value) {
    const match = FILE_URL.exec(String(value));

    if (!match || !isLocalAuthority(match.groups.authority)) {
        return "";
    }

    return decodePath(match.groups.path);
}

function isCliInput(input) { return Array.isArray(input) && input.every((item) => typeof item === "string"); }

module.exports = { isCliInput, normalizeInvocationInput, decodeFileUrl };
