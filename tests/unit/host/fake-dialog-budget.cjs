"use strict";

function consumePrompt(host) {
    host.promptCount = (host.promptCount ?? 0) + 1;

    if (host.promptCount > (host.promptLimit ?? 100)) {
        throw new Error("the test exhausted its dialog budget; an unexpected prompt loop occurred");
    }
}

module.exports = { consumePrompt };
