import { Controller } from '@hotwired/stimulus';
import { clone } from './clone.js';
import { createState, destroyState } from './createState.js';

/**
 * Builds a Stimulus controller class whose element gets the Alpine state `state`, so a
 * controller file only has to `export default withStateController(state)`.
 *
 * `state` holds the defaults; every instance gets its own copy (clone(), so its data fields must
 * be plain data, like the JSON Twig can set). Twig can override any of its fields with the
 * Stimulus value `state` (JSON), e.g. `stimulus_controller('example', { state: { message: '…' } })`.
 * So every field Twig may set needs a default; an unknown one is still set, but logs a warning.
 * Object.assign() writes onto the copy instead of spreading it, so getters (Alpine's computed
 * properties) stay getters.
 */
export function withStateController(state) {
    return class extends Controller {
        static values = { state: { type: Object, default: {} } };

        connect() {
            createState(this, (controller) => {
                const instance = clone(state);
                instance.$element =  controller.element;
                instance.$identifier =  controller.identifier;

                // A field the defaults don't define is most likely a typo in Twig.
                for (const key of Object.keys(controller.stateValue)) {
                    if (!(key in instance)) {
                        console.warn(`${controller.identifier}: unknown state field "${key}"`);
                    }
                }

                return Object.assign(instance, controller.stateValue);
            });
        }

        disconnect() {
            destroyState(this);
        }
    };
}
