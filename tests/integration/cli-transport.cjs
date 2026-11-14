"use strict";
const { parseReceipt } = require("./lib/receipt.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const [artifact, work, configuration, original] = process.argv.slice(2);
const outputFailure = "Standard output could not be completed.";

fs.mkdirSync(work, { recursive: true });

function fixture(name) {
    const folder = path.join(work, name); fs.mkdirSync(folder);
    const output = path.join(folder, "photo_stamped.png"), source = path.join(folder, "photo.png");
    fs.copyFileSync(original, source);
    return { source, output, bytes: fs.readFileSync(source), args: [artifact, "--headless", configuration, source] };
}

function verified(result, sample) {
    assert.ifError(result.error);
    assert.deepEqual(fs.readFileSync(sample.source), sample.bytes, "transport failure never changes the source");
    assert.equal(execFileSync("vipsheader", ["-f", "width", sample.output], { encoding: "utf8" }).trim(), "600");
    assert.equal(execFileSync("vipsheader", ["-f", "height", sample.output], { encoding: "utf8" }).trim(), "400");
    execFileSync("vips", ["avg", `${sample.output}[fail_on=warning]`], { stdio: "pipe" });
}

function failedOutput(result, sample) {
    verified(result, sample);
    assert.equal(result.status, 1, result.stderr); assert.equal(result.signal, null, result.stderr);
    assert.match(result.stderr, /^Created 1 stamped copy\./u);
    assert.equal(result.stderr.split(outputFailure).length - 1, 1, result.stderr);
    assert.ok(result.stderr.endsWith(`${outputFailure}\n`));
    assert.doesNotMatch(result.stderr, /execution error|\(-2700\)|\n\s+at \w|"diagnostic"/u);
}

function withBrokenPipe(name, use) {
    const fifo = path.join(work, name); execFileSync("mkfifo", [fifo]);
    // Open both ends without blocking, then close the only reader BEFORE exec.
    // Unlike /dev/null or a racing head process, the first child write is EPIPE.
    // eslint-disable-next-line no-bitwise -- POSIX open flags are independent bitmasks.
    const reader = fs.openSync(fifo, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    // eslint-disable-next-line no-bitwise -- POSIX open flags are independent bitmasks.
    const writer = fs.openSync(fifo, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK);
    fs.closeSync(reader);
    try { return use(writer); }
    finally { fs.closeSync(writer); }
}

const closed = fixture("closed-stdout");
const closedResult = spawnSync("/bin/sh", ["-c", 'exec 1>&-; exec /usr/bin/osascript -l JavaScript "$@"', "closed-stdout", ...closed.args],
    { encoding: "utf8", timeout: 30000, killSignal: "SIGKILL" });
failedOutput(closedResult, closed); assert.equal(closedResult.stdout, "");

const pipe = fixture("broken-stdout");
const pipeResult = withBrokenPipe("output-pipe", (descriptor) => spawnSync("/usr/bin/osascript", ["-l", "JavaScript", ...pipe.args],
    { encoding: "utf8", stdio: ["ignore", descriptor, "pipe"], timeout: 30000, killSignal: "SIGKILL" }));
failedOutput(pipeResult, pipe);

for (const kind of ["--help", "--version"]) {
    const result = withBrokenPipe(`${kind.slice(2)}-pipe`, (descriptor) => spawnSync("/usr/bin/osascript", ["-l", "JavaScript", artifact, kind],
        { encoding: "utf8", stdio: ["ignore", descriptor, "pipe"], timeout: 30000, killSignal: "SIGKILL" }));
    assert.ifError(result.error); assert.equal(result.status, 1); assert.equal(result.signal, null);
    assert.equal(result.stderr, `${outputFailure}\n`);
}

const prose = fixture("broken-stderr");
const proseResult = withBrokenPipe("report-pipe", (descriptor) => spawnSync("/usr/bin/osascript", ["-l", "JavaScript", ...prose.args],
    { encoding: "utf8", stdio: ["ignore", "pipe", descriptor], timeout: 30000, killSignal: "SIGKILL" }));
verified(proseResult, prose);
assert.ok(proseResult.status !== 0 || proseResult.signal !== null, "the first transport refusal remains nonzero");
const receipt = parseReceipt(proseResult.stdout);
assert.equal(receipt.state, "complete"); assert.equal(receipt.images[0].output, prose.output);
console.log("macOS CLI transport passed: closed output, prebroken output pipe, prebroken report pipe and published/source integrity");
