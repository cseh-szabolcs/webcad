/* stimulusFetch: 'lazy' */
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';

/*
 * Example of a list whose pages come from the backend (see assets/scripts/states/remoteListState.js),
 * used by templates/page/fixtures/list-example.html.twig:
 * {{ stimulus_controller('page--fixtures--list-example', { state: { url: path('…') } }) }}.
 */
const state = extend(remoteListState, {
    pageSize: 5,
});

export default withStateController(state);
