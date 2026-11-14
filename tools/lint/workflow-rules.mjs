import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { root } from "../repository.mjs";

const WORKFLOW_ROOT = ".github/workflows";
const WORKFLOW_EXTENSION = /\.ya?ml$/u;

/*
 * An empty result means the workflows moved or the glob broke, which would
 * otherwise read as "everything passed".
 */
export function assertWorkflowsFound(files) {
    if (files.length === 0) {
        throw new Error("no workflows found; the gate expects .github/workflows");
    }
}

export function isWorkflow(name) {
    return WORKFLOW_EXTENSION.test(name);
}

/*
 * Filtered so nothing but a workflow is handed to actionlint, and sorted so
 * the gate reports the same order every run.
 */
export function selectWorkflows(entries) {
    return entries.filter(isWorkflow).sort();
}

/*
 * Pin every external action to a commit. A mutable tag or branch can point at
 * different code while retaining the job's permissions. Dependabot updates
 * commit pins with their version comments; this check rejects unpinned actions.
 */
const USES = /^\s*(?:-\s*)?uses:\s*(?<action>\S+)/gmu;
const COMMIT_PINNED = /@[\da-f]{40}$/u;

export function unpinnedActions(text) {
    return [...String(text).matchAll(USES)]
        .map((match) => match.groups.action)
        // A local action is part of this repository and moves with it.
        .filter((action) => !action.startsWith("./"))
        .filter((action) => !COMMIT_PINNED.test(action));
}

export function assertPinned(file, text) {
    const loose = unpinnedActions(text);

    if (loose.length > 0) {
        throw new Error(
            `${file}: actions must be pinned to a commit SHA, not a tag: ${
                loose.join(", ")}`
        );
    }
}

async function workflowFiles() {
    return selectWorkflows(await readdir(path.join(root, WORKFLOW_ROOT)));
}

export function probeActionlint(exec = execFileSync) {
    exec("actionlint", ["--version"], { stdio: "ignore" });
}

export function hasActionlint(probe = probeActionlint) {
    try {
        probe();

        return true;
    } catch {
        return false;
    }
}

/*
 * Read workflows as UTF-8 text from the workflow directory so action-pinning
 * patterns inspect their contents rather than an undecoded Buffer.
 */
export function readWorkflow(file, read = readFile) {
    return read(path.join(root, WORKFLOW_ROOT, file), "utf8");
}

export function runActionlint(files, exec = execFileSync) {
    exec("actionlint", files, { stdio: "inherit" });
}

/*
 * Statically validate workflow schemas, expressions and run-step shell syntax
 * with actionlint before hosted execution. It is optional for local machines
 * without the tool; the macOS CI job installs and runs it.
 */
export async function checkWorkflows(options = {}) {
    // The probe is a parameter so that the decision to run actionlint can
    // be tested, not only the two answers it leads to.
    const available = options.available ?? hasActionlint(options.probe);
    const found = options.files ?? await workflowFiles();
    const run = options.run ?? runActionlint;

    assertWorkflowsFound(found);

    const read = options.read ?? readWorkflow;

    await Promise.all(found.map(async (file) => {
        assertPinned(file, await read(file));
    }));

    if (!available) {
        return `${found.length} workflows (actionlint not installed, skipped)`;
    }

    // A non-zero exit throws, which fails the gate. Injected like the probe,
    // so the branch can be exercised on a machine that does not have
    // actionlint — which every Linux runner in this repository is.
    run(found.map((file) => path.join(root, WORKFLOW_ROOT, file)));

    return `${found.length} workflows, actionlint passed`;
}
