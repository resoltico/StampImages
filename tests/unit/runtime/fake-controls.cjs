"use strict";

function accessible(control) {
    control.setAccessibilityLabel = (label) => { control.accessibilityLabel = label; };
    control.setAccessibilityHelp = (help) => { control.accessibilityHelp = help; };

    return control;
}

function makeCheckbox(frame) {
    const button = accessible({ kind: "checkbox", frame, state: 0 });

    button.setButtonType = (type) => { button.buttonType = type; };

    button.bindToObjectWithKeyPathOptions = (name, object, key, options) => {
        button.binding = { name, object, key, options };
        button.state = object[key] ? 1 : 0;
    };
    button.performClick = () => {
        button.state = button.state === 1 ? 0 : 1;
        button.binding.object[button.binding.key] = button.state === 1;
    };
    button.unbind = (name) => { button.unbound = name; };

    return button;
}

module.exports = { accessible, makeCheckbox };
