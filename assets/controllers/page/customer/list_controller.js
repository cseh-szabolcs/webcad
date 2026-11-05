/* stimulusFetch: 'lazy' */
import { formatDate } from '../../../scripts/date.js';
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';

/*
 * The plain lists of the customer area, whose pages come from the backend (see
 * assets/scripts/states/remoteListState.js), used by templates/page/customer/_list_layout.html.twig.
 * The customers themselves have their own state (customer_list_controller.js).
 */
const state = extend(remoteListState, { formatDate });

export default withStateController(state);
