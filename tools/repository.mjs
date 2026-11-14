import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Resolve the repository root without importing the builder or dependencies.
 * Release-note and tag entry points run without npm packages installed in the
 * permissioned publishing job.
 */
export const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);
