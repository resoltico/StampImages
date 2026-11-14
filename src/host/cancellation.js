"use strict";
const { UserCanceled, isUserCanceled, causes } = require("../core/errors.js");
const CANCEL_ERROR_NUMBER = -128;
function hostError(error) {
    if (isUserCanceled(error)) { return error; }
    return causes(error).some((cause) => cause.errorNumber === CANCEL_ERROR_NUMBER)
        ? new UserCanceled({ cause: error }) : error;
}
module.exports = { hostError };
