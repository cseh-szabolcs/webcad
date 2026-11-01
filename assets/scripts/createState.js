import Alpine from 'alpinejs';

/**
 * Gives a Stimulus controller's element an Alpine state.
 *
 * `factory(controller)` must return a new object on every call, so that instances never share
 * nested arrays or objects. The registration under the controller's identifier is global, but it
 * is renewed on every connect() and evaluated right away by initTree(), so each instance gets
 * the state of its own controller.
 */
export function createState(controller, factory) {
    const { element } = controller;
    const name = dataName(controller.identifier);
    Alpine.data(name, () => factory(controller));
    // mutateDom() hides the change from Alpine's MutationObserver, which would otherwise
    // initialise the element a second time (init() would run twice).
    Alpine.mutateDom(() => element.setAttribute('x-data', name));
    // An element inserted after the page load was already walked by Alpine's MutationObserver
    // (without x-data) and is marked as done, so initTree() would skip it: undo that first.
    Alpine.destroyTree(element);
    Alpine.initTree(element);
}

/**
 * The Alpine.data() name of a Stimulus identifier. Alpine evaluates x-data as a JavaScript
 * expression, so `example-list` would be `example - list`: every character that is not allowed
 * in a name becomes `_` (`example-list` → `example_list`, `layout--theme` → `layout__theme`).
 * Stimulus identifiers contain no `_`, so two identifiers never get the same name.
 */
function dataName(identifier) {
    return identifier.replace(/[^A-Za-z0-9_$]/g, '_');
}

/** Removes the Alpine state again (effects, listeners); call it in disconnect(). */
export function destroyState(controller) {
    Alpine.destroyTree(controller.element);
    Alpine.mutateDom(() => controller.element.removeAttribute('x-data'));
}
