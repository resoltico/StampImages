import * as acorn from "acorn";

/*
 * Shared JavaScript parsing and token comparison for build and lint tools.
 * The ECMAScript version is supplied by each caller; release.mjs declares the
 * runtime floor. Production JXA is parsed as a classic script because osascript
 * calls run() by name.
 */

const parseOptions = (ecmaVersion) => ({ ecmaVersion, sourceType: "script" });

/*
 * The syntax tree, with every node carrying the byte range it came from, so a
 * caller can remove a statement without reprinting anything.
 */
export function parseScript(source, ecmaVersion) {
    return acorn.parse(source, parseOptions(ecmaVersion));
}

export function commentsIn(source, ecmaVersion) {
    const comments = [];

    acorn.parse(source, {
        ...parseOptions(ecmaVersion),
        onComment: (block, text, start, end) => comments.push({ text, start, end })
    });

    return comments;
}

/*
 * The tokens a parser reads, which is the program itself: two texts with the
 * same token sequence differ only in what the parser discards.
 */
export function tokensOf(text, ecmaVersion) {
    return [...acorn.tokenizer(text, parseOptions(ecmaVersion))]
        .map((token) => `${token.type.label} ${String(token.value)}`);
}

/*
 * Asserted during the build rather than in a test alone, so a stripped
 * artifact that is not the same program cannot reach the disk.
 */
export function assertSameProgram(before, after, ecmaVersion) {
    const original = tokensOf(before, ecmaVersion);
    const stripped = tokensOf(after, ecmaVersion);
    const index = original.findIndex((token, at) => token !== stripped[at]);

    if (original.length !== stripped.length || index >= 0) {
        const where = index < 0 ? "" : `, first difference at token ${index}`;

        throw new Error(
            `stripping comments changed the program: ${original.length} ` +
            `tokens became ${stripped.length}${where}`
        );
    }
}
