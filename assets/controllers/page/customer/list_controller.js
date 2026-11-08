/* stimulusFetch: 'lazy' */
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';
import { on } from "../../../scripts/event.js";

/* The customer list, pages from the backend (remoteListState). */
const state = (controller, {$watch}) => extend(remoteListState, {
    pageSize: 2,
    sortKey: 'updated',
    sortDirection: 'desc',

    init() {
        super.init();
        this.load();

        on(`app_cmp_context-menu:${controller.contextIdValue}:action`, ({item, action}) => {
            this.handleContextMenuAction(item, action);
        });
    },

    applyFilterSearch(text, e) {
        console.log("SSSSSSSS", text);
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
