"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
function replaceOnce(text, before, after) {
    assert.equal(text.split(before).length, 2, "the controlled replacement must reach the live native operation exactly once");
    return text.replace(before, after);
}
function controlProgram(argv, mode, tool) {
    const parameters = argv.filter((value, index) => argv[index - 1] === "-userParam");
    const target = parameters.find((value) => value.startsWith("target=")).slice("target=".length);
    const index = argv.findIndex((value) => value.startsWith("Filter="));
    assert.ok(index >= 0); assert.ok(argv[index].includes("TargetFile=>$dst"));
    if (mode === "setter") {
        argv[index] = replaceOnce(argv[index], '"IFD0:Orientation#=1"', '"UnknownRequiredMetadataTag=1"');
    } else if (mode === "producer-write") {
        argv[index] = replaceOnce(argv[index], "my $status=$producerWriter->WriteInfo($dst);", "my $status=0;");
    } else if (mode === "producer-readback") {
        argv[index] = replaceOnce(argv[index], "$add->('Restored IPTC packet differs from the captured source')", "$actual->{packet}='mismatched read-back'; $add->('Restored IPTC packet differs from the captured source')");
    } else if (mode === "readback") {
        const changed = spawnSync(tool, ["-overwrite_original", "-GPSLatitude=0", "-GPSLatitudeRef=N", target], { encoding: "utf8" });
        assert.equal(changed.status, 0, changed.stderr);
        argv[index] = replaceOnce(argv[index], "$set->($key,$entry->{value},Type=>'Raw',Replace=>1);", "next if $key eq 'GPS:GPSLatitude'; $set->($key,$entry->{value},Type=>'Raw',Replace=>1);");
    }
}
function runMetadataFailure(argv) {
    const tool = process.env.STAMP_IMAGES_REAL_EXIFTOOL;
    if (!argv.includes("-userParam")) {
        const result = spawnSync(tool, argv, { encoding: "utf8" });
        process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status ?? 1; return;
    }
    const mode = process.env.STAMP_IMAGES_METADATA_CONTROL;
    fs.appendFileSync(process.env.STAMP_IMAGES_METADATA_MARKER, "called");
    controlProgram(argv, mode, tool);
    const result = spawnSync(tool, argv, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const packet = JSON.parse(result.stdout);
    const originalTarget = packet[0].FileName.TargetFile;
    if (mode === "wrong-target") { packet[0].FileName.TargetFile = "/unassociated-candidate.png"; }
    if (mode === "missing-target") { delete packet[0].FileName.TargetFile; }
    fs.writeFileSync(process.env.STAMP_IMAGES_METADATA_CONTROL_RECORD, JSON.stringify({ mode, originalTarget, nativeStatus: result.status, packet }));
    process.stdout.write(JSON.stringify(packet)); process.stderr.write(result.stderr);
}
module.exports = { runMetadataFailure };
