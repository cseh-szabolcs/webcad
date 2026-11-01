import { Controller } from '@hotwired/stimulus';
import { createState, destroyState } from './createState.js';

/**
 * Builds a Stimulus controller class whose element gets the Alpine state of `factory`, so a
 * controller file only has to `export default stateController(…)`.
 *
 * The factory returns the defaults. Twig can override any of its fields with the Stimulus value
 * `state` (JSON), e.g. `stimulus_controller('example', { state: { message: '…' } })`. So every
 * field Twig may set needs a default; an unknown one is still set, but logs a warning.
 * Object.assign() writes onto the factory's object instead of spreading it, so getters (Alpine's
 * computed properties) stay getters.
 */
export function stateController(factory) {
    return class extends Controller {
        static values = { state: { type: Object, default: {} } };

        connect() {
            createState(this, (controller) => {
                const state = factory(controller);
                // A field the defaults don't define is most likely a typo in Twig.
                for (const key of Object.keys(controller.stateValue)) {
                    if (!(key in state)) {
                        console.warn(`${controller.identifier}: unknown state field "${key}"`);
                    }
                }

                return Object.assign(state, controller.stateValue);
            });
        }

        disconnect() {
            destroyState(this);
        }
    };
}
