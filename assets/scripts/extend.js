import { clone } from './clone.js';

/**
 * A copy of `base` with the fields of `extensions` on top (like Object.assign(), but via clone():
 * getters stay getters, nothing nested is shared, fields are replaced, not merged).
 *
 * `super` works in the extensions' methods and getters (`init() { super.init(); … }`): `super`
 * is the prototype of the object literal, so each extension gets what came before it as its
 * prototype. Only with the method syntax (`init() {}`), not with `init: () => {}`.
 */
export function extend(base, ...extensions) {
    let result = clone(base);
    for (const extension of extensions) {
        // A copy as the parent, so later extensions don't change what this one's super sees.
        const parent = result;
        result = clone(parent);
        Object.setPrototypeOf(extension, parent);
        Object.defineProperties(result, Object.getOwnPropertyDescriptors(clone(extension)));
    }

    return result;
}
