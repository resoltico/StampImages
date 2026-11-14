"use strict";
const { OperationError } = require("../core/errors.js");
function projectionArgv(exiftool, source, program, parameters = []) {
    return [exiftool, "-json", "-api", "StructFormat=JSONQ", "-api", "SaveFormat=1", "-api", `Filter=${program}`,
        ...parameters.flatMap((value) => ["-userParam", value]), "-System:FileName", source];
}
function record(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function parseOutput(output) {
    try { return JSON.parse(String(output)); }
    catch (cause) { throw new OperationError("ExifTool did not return valid metadata JSON.", { cause }); }
}
function readProjection(output, source) {
    const answer = parseOutput(output);
    if (!Array.isArray(answer) || answer.length !== 1 || !record(answer[0])) {
        throw new OperationError("ExifTool did not return one metadata record.");
    }
    const [envelope] = answer;
    if (envelope.Error) { throw new OperationError(String(envelope.Error)); }
    if (typeof envelope.SourceFile !== "string" || envelope.SourceFile !== source ||
        Object.keys(envelope).some((key) => !["SourceFile", "FileName", "Error"].includes(key))) {
        throw new OperationError("ExifTool did not identify the requested metadata source.");
    }
    const projection = envelope.FileName;
    if (!record(projection) || typeof projection.ExifToolVersion !== "string" ||
        !/^\d+(?:\.\d+)?$/u.test(projection.ExifToolVersion)) {
        throw new OperationError("ExifTool did not return the structured raw metadata projection.");
    }
    if (projection.Error) { throw new OperationError(String(projection.Error)); }
    return projection;
}
module.exports = { projectionArgv, readProjection };
