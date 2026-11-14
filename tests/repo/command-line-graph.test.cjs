"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const root = path.resolve(__dirname, "../..");
const entry = path.join(root, "src/host/command-line/main.js");
const fontCatalog = path.join(root, "src/host/typefaces.js");

function commandLineGraph(read = readFileSync) {
    const visited = new Set();
    const pending = [entry];
    while (pending.length > 0) {
        const file = pending.pop();
        if (!visited.has(file)) {
            visited.add(file);
            const source = read(file, "utf8");
            if (file !== fontCatalog) { assert.doesNotMatch(source, /import\(["']AppKit["']\)/u, `AppKit outside font catalog: ${file}`); }
            assert.equal(file.includes("/quick-action/"), false, file);
            for (const match of source.matchAll(/require\("(?<target>\.[^"]+)"\)/gu)) {
                pending.push(path.resolve(path.dirname(file), match.groups.target));
            }
        }
    }
    return visited;
}

test("the CLI graph reaches AppKit only through its shared font catalog", () => {
    const visited = commandLineGraph();
    assert.ok(visited.size > 30, "the full use-case graph was traversed");
    assert.ok(visited.has(fontCatalog));
    assert.match(readFileSync(fontCatalog, "utf8"), /import\("AppKit"\)/u);
});

test("the graph check rejects a quick-action dependency and a second AppKit import", () => {
    for (const injection of ['require("../quick-action/input.js");', 'ObjC.import("AppKit");']) {
        assert.throws(() => commandLineGraph((file) => readFileSync(file, "utf8") + (file === entry ? injection : "")), /quick-action|AppKit/u);
    }
});
