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
    const { element, identifier } = controller;
    Alpine.data(identifier, () => factory(controller));
    // mutateDom() hides the change from Alpine's MutationObserver, which would otherwise
    // initialise the element a second time (init() would run twice).
    Alpine.mutateDom(() => element.setAttribute('x-data', identifier));
    // An element inserted after the page load was already walked by Alpine's MutationObserver
    // (without x-data) and is marked as done, so initTree() would skip it: undo that first.
    Alpine.destroyTree(element);
    Alpine.initTree(element);
}

/** Removes the Alpine state again (effects, listeners); call it in disconnect(). */
export function destroyState(controller) {
    Alpine.destroyTree(controller.element);
    Alpine.mutateDom(() => controller.element.removeAttribute('x-data'));
}
