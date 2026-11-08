/* stimulusFetch: 'lazy' */
import { withStateController } from '../scripts/withStateController.js';

/* Example of an Alpine state from a Stimulus controller: {{ stimulus_controller('example') }}. */
const state = () => ({
    init() {
        console.log('example: state initialised');
    },
});

export default withStateController(state);
