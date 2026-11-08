import { Controller } from '@hotwired/stimulus';
import { createState, destroyState } from './createState.js';

/**
 * A Stimulus controller class whose element gets the Alpine state of `state(controller, magics)`,
 * a factory that returns a new object on every call (see createState.js for `magics`). `values`
 * are further Stimulus values (`{ url: String }` → `controller.urlValue`), outside of Alpine.
 * Twig can override the state's fields with the Stimulus value `state`.
 */
export function withStateController(state, values = {}) {
    if (typeof state !== 'function') {
        throw new TypeError('withStateController() needs a factory: (controller, magics) => ({ … })');
    }

    return class extends Controller {
        static values = { ...values, state: { type: Object, default: {} } };

        connect() {
            createState(this, (controller, magics) => {
                const instance = state(controller, magics);
                for (const [key, value] of Object.entries(controller.stateValue)) {
                    setField(controller, instance, key, value);
                }

                return instance;
            });
        }

        disconnect() {
            destroyState(this);
        }
    };
}

/** Sets a field from Twig; an assignment, so a getter with a setter stays one. */
function setField(controller, instance, key, value) {
    const descriptor = Object.getOwnPropertyDescriptor(instance, key);
    if (!(key in instance)) {
        // Most likely a typo in Twig; still set.
        console.warn(`${controller.identifier}: unknown state field "${key}"`);
    } else if (descriptor?.get && !descriptor.set) {
        console.warn(`${controller.identifier}: state field "${key}" is a getter, Twig can't set it`);

        return;
    }
    instance[key] = value;
}
