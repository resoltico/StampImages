/*
 * Check a release tag before anything is published under it. The rule lives
 * in tools/lint/consistency.mjs and is unit tested; this file only supplies
 * the command-line tag.
 */
import { checkReleaseTag } from "./lint/consistency.mjs";

// node, the script, then the tag.
const ARGUMENTS_START = 2;

const [tag] = process.argv.slice(ARGUMENTS_START);

if (!tag) {
    throw new Error("usage: node tools/check-tag.mjs <tag>");
}

const version = await checkReleaseTag(tag);

console.log(`release tag ${tag} matches the declared version ${version}`);
