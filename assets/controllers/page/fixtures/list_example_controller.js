/* stimulusFetch: 'lazy' */
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';

/* A list whose pages come from the backend (remoteListState), used by list-example.html.twig. */
const state = (controller, { $watch, $refs }) => extend(remoteListState, {
    pageSize: 5,

    get url() {
        return controller.urlValue;
    },
});

export default withStateController(state, { url: String });
