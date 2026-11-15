"use strict";

function accessible(control) {
    const rect = control.rect ?? control.frame;
    if (!control.frame) { Object.defineProperty(control, "frame", { get: () => control.rect, set: (frame) => { control.rect = frame; } }); }
    control.bounds = { left: 0, bottom: 0, width: rect.width, height: rect.height };
    control.layer = { sublayers: [], addSublayer(layer) { this.sublayers.push(layer); } };
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
