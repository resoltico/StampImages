import { readFromDisk } from "./consistency.mjs";

/*
 * Read release summaries from CHANGELOG.md, their authoritative source.
 * Do not keep a second manually maintained per-tag summary.
 */

const HEADING = "## ";

// Keep a Changelog brackets the version in a release heading, and puts an
// [Unreleased] section above the newest release. Matching the brackets is
// what keeps that section from being taken for a release.
const releaseHeading = (version) => `${HEADING}[${version}]`;

/*
 * Match release headings as literal strings. Version dots must not act as
 * regular-expression wildcards, and Unreleased is not a version heading.
 */
function isHeadingFor(line, version) {
    const heading = releaseHeading(version);

    if (!line.startsWith(heading)) {
        return false;
    }

    const rest = line.slice(heading.length);

    return rest === "" || rest.startsWith(" ");
}

export async function releaseNotes(version, read = readFromDisk) {
    const lines = (await read("CHANGELOG.md")).split("\n");
    const start = lines.findIndex((line) => isHeadingFor(line, version));

    if (start < 0) {
        throw new Error(`CHANGELOG.md has no section for ${version}`);
    }

    const following = lines
        .slice(start + 1)
        .findIndex((line) => line.startsWith(HEADING));

    return lines
        .slice(start, following < 0 ? lines.length : start + 1 + following)
        .join("\n")
        .trim();
}
