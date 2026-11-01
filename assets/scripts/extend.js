import { clone } from './clone.js';

/**
 * A new object with the fields of `base` and then of each of `extensions`, a later one replacing
 * a field of the same name (left to right, like Object.assign()). Each source is copied with
 * clone(), so getters stay getters and the result shares no nested arrays or objects with its
 * sources; the sources stay unchanged. A field is replaced as a whole: nested objects are not
 * merged.
 *
 * Meant for states that build on others, e.g. a list state with pagination:
 *
 *     const listState = {
 *         page: 1,
 *         pageSize: 20,
 *         items: [],
 *         get pageCount() { return Math.ceil(this.items.length / this.pageSize); },
 *         init() { … },
 *     };
 *
 *     const state = extend(listState, {
 *         pageSize: 50,
 *         init() {
 *             listState.init.call(this);   // the base method, as `super` does not work here
 *             …
 *         },
 *     });
 *
 *     export default withStateController(state);
 *
 * `super.init()` does not work: in an object literal `super` refers to the prototype of that
 * literal, not to `base`. Call the base method with `.call(this)` instead.
 */
export function extend(base, ...extensions) {
    const result = clone(base);
    for (const extension of extensions) {
        Object.defineProperties(result, Object.getOwnPropertyDescriptors(clone(extension)));
    }

    return result;
}
