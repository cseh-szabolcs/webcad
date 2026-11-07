const context = {};

export function add(key, value) {
    context[key] = value;
}

export function get(key, defaultValue = null) {
    return Object.hasOwn(context, key)
        ? context[key]
        : defaultValue;
}

export function remove(key) {
    if (context[key]) {
        delete context[key];
    }
}

window.context = {
    add,
    get,
    remove,
}

export default {
    add,
    get,
    remove,
}
