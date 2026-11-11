import Alpine from 'alpinejs';

/**
 * Gives a Stimulus controller's element the Alpine state `factory(controller, magics)`. The
 * Alpine.data() name is global, but renewed on every connect() and used right away.
 */
export function createState(controller, factory) {
    const { element } = controller;
    const name = dataName(controller.identifier);
    // A function, not an arrow: Alpine calls it with `this` = the magics of the x-data element.
    Alpine.data(name, function () {
        return factory(controller, stateMagics(this));
    });
    // mutateDom() hides the change from Alpine's MutationObserver, which would otherwise
    // initialise the element a second time (init() would run twice).
    Alpine.mutateDom(() => element.setAttribute('x-data', name));
    // An element inserted after the page load was already walked by Alpine's MutationObserver
    // (without x-data) and is marked as done, so initTree() would skip it: undo that first.
    Alpine.destroyTree(element);
    // destroyTree() leaves an empty _x_dataStack on nested x-data elements, which would hide
    // the parent scopes from them (a nested state created before this one).
    deleteEmptyDataStack(element);
    Alpine.initTree(element);
}

/**
 * All of Alpine's magics of the element, read only when taken; call $watch() in init(), not in
 * the factory. `$refs` and `$data` are read on every access: in the factory they don't exist yet,
 * and Alpine would keep an empty $refs for good.
 */
function stateMagics(magics) {
    const result = {};
    for (const name of Object.getOwnPropertyNames(magics)) {
        Object.defineProperty(result, name, {
            get: LIVE_MAGICS.includes(name) ? () => liveMagic(magics, name) : () => magics[name],
            enumerable: true,
        });
    }

    return result;
}

const LIVE_MAGICS = ['$refs', '$data'];

/** An object that passes every access on to the magic `name`, read at the time of the access. */
function liveMagic(magics, name) {
    return new Proxy({}, {
        get: (target, key) => magics[name][key],
        set: (target, key, value) => Reflect.set(magics[name], key, value),
        has: (target, key) => key in magics[name],
    });
}

/** x-data is evaluated as JavaScript, so `layout--theme` becomes `layout__theme`. */
function dataName(identifier) {
    return identifier.replace(/[^A-Za-z0-9_$]/g, '_');
}

/** Removes the Alpine state again (effects, listeners); call it in disconnect(). */
export function destroyState(controller) {
    Alpine.destroyTree(controller.element);
    Alpine.mutateDom(() => controller.element.removeAttribute('x-data'));
}

/** Removes an empty _x_dataStack on nested x-data elements */
function deleteEmptyDataStack(element) {
    for (const el of [element, ...element.querySelectorAll('*')]) {
        if (el._x_dataStack?.length === 0) {
            delete el._x_dataStack;
        }
    }
}
