/* stimulusFetch: 'lazy' */
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';
import { on } from "../../../scripts/event.js";

/* The customer list, pages from the backend (remoteListState). */
const state = (controller) => extend(remoteListState, {
    pageSize: 5,
    sortModel: 'created:desc',

    init() {
        super.init();

        on(`app_cmp_context-menu:${controller.contextIdValue}:action`, ({item, action}) => {
            this.handleContextMenuAction(item, action);
        });
    },

    testHandler(event) {
        alert(event.target.value)
    },

    get url() {
        return controller.urlValue;
    },

    handleContextMenuAction(item, action) {
        alert(item + ' : ' + action);
    },

    getContextMenuLabel() {
        return 'Text Text'
    },
});

export default withStateController(state, { url: String, contextId: String });
