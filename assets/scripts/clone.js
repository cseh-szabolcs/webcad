/**
 * A copy that shares nothing mutable with `source`. Unlike a spread it keeps getters (their `this`
 * is the copy) and clones data deeply; data must be plain (structuredClone).
 */
export function clone(source) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const descriptor of Object.values(descriptors)) {
        if ('value' in descriptor && typeof descriptor.value !== 'function') {
            descriptor.value = structuredClone(descriptor.value);
        }
    }

    return Object.defineProperties({}, descriptors);
}
