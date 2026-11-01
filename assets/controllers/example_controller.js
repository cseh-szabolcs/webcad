/* stimulusFetch: 'lazy' */
import { withStateController } from '../scripts/withStateController.js';

/*
 * Example of an Alpine state from a Stimulus controller (see assets/scripts/withStateController.js).
 * Use it with {{ stimulus_controller('example') }} on an element.
 */
const state = {
    init() {
        console.log('example: state initialised');
    },
};

export default withStateController(state);
