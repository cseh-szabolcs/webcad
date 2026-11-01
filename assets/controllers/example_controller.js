/* stimulusFetch: 'lazy' */
import { stateController } from '../scripts/stateController.js';

/*
 * Example of an Alpine state from a Stimulus controller (see assets/scripts/stateController.js).
 * Use it with {{ stimulus_controller('example') }} on an element.
 */
export default stateController(() => ({
    init() {
        console.log('example: state initialised');
    },
}));
