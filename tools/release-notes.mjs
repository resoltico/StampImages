/*
 * Print the CHANGELOG section for a release tag. The section-selection rule
 * lives in tools/lint/consistency.mjs and is unit tested; this file only
 * supplies the command-line tag and writes the selected text.
 */
import { checkReleaseTag } from "./lint/consistency.mjs";
import { releaseNotes } from "./lint/notes.mjs";

// node, the script, then the tag.
const ARGUMENTS_START = 2;

const [tag] = process.argv.slice(ARGUMENTS_START);

if (!tag) {
    throw new Error("usage: node tools/release-notes.mjs <tag>");
}

const version = await checkReleaseTag(tag);

console.log(await releaseNotes(version));
