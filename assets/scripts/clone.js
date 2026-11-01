/**
 * A copy of the object `source` that shares nothing mutable with it. A spread ({...source})
 * would not do: it calls every getter once and keeps only its value, and it is shallow, so the
 * copies would share nested arrays and objects. Here accessors (getters/setters) and methods are
 * taken over as they are (a getter's `this` is then the copy), data values are cloned deeply.
 * Data values must therefore be plain data: structuredClone throws on functions and DOM nodes,
 * and class instances lose their prototype.
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
