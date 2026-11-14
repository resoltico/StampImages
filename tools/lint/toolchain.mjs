import { assertAll, readFromDisk } from "./consistency.mjs";

/*
 * Check that documented and CI Homebrew installs agree and provide every
 * command required by the integration suites.
 */

const INSTALL_SOURCES = [
    "CONTRIBUTING.md",
    ".github/workflows/quality.yml",
    ".github/workflows/release.yml"
];

const INSTALL = /brew install (?<value>[^\n`]+)/gu;
const REQUIRED_TOOLS = /for tool in (?<value>[^;]+); do/u;

/*
 * Map required commands to the formulae that provide them. Do not rely on
 * transitive dependencies to supply commands missing from the declared install.
 */
const PROVIDED_BY = {
    vips: "vips",
    vipsheader: "vips",
    exiftool: "exiftool"
};

// Ships with macOS, so no formula installs it.
const PREINSTALLED = new Set(["osascript", "cmp"]);

export function formulaFor(tool, provided = PROVIDED_BY) {
    if (PREINSTALLED.has(tool)) {
        return "";
    }

    if (!Object.hasOwn(provided, tool)) {
        throw new Error(
            `the integration suite requires ${tool}, and nothing records ` +
            "which formula provides it; add it to PROVIDED_BY"
        );
    }

    const formula = provided[tool];

    /*
     * A blank formula mapping differs from a command that ships with macOS.
     * Reject blank mappings so a required external tool cannot be silently exempted
     * from the declared installation commands.
     */
    // things, and sharing one representation would let the first pass as the
    // second — silently exempting a tool from the check, which is how tiffcp
    // came to be required by the suite and installed by nothing.
    if (formula === "") {
        throw new Error(
            `${tool} is mapped to no formula; if it ships with macOS it ` +
            "belongs in PREINSTALLED, and otherwise it needs a formula"
        );
    }

    return formula;
}

export function missingFormulae(installed, tools) {
    const present = new Set(installed);

    return tools
        .map((tool) => formulaFor(tool))
        .filter((formula) => formula !== "" && !present.has(formula));
}

async function installCommands(read) {
    const found = [];

    await Promise.all(INSTALL_SOURCES.map(async (file) => {
        const matches = [...String(await read(file)).matchAll(INSTALL)];

        if (matches.length === 0) {
            throw new Error(`${file} no longer documents the install command`);
        }

        matches.forEach((match, index) => {
            found.push([`${file} (${index + 1})`, match.groups.value.trim()]);
        });
    }));

    return found.sort();
}

export async function checkToolchain(read = readFromDisk) {
    const installed = await assertAll("install commands", await installCommands(read));
    const fixtures = String(await read("tests/integration/lib/fixtures.sh"));
    const required = REQUIRED_TOOLS.exec(fixtures);

    if (!required) {
        throw new Error(
            "tests/integration/lib/fixtures.sh no longer lists its required tools"
        );
    }

    const formulae = installed.split(/\s+/u);
    const missing = missingFormulae(
        formulae,
        required.groups.value.trim().split(/\s+/u)
    );

    if (missing.length > 0) {
        throw new Error(
            "the integration suite requires tools the documented install does " +
            `not provide: ${[...new Set(missing)].join(", ")}`
        );
    }

    return formulae.length;
}
