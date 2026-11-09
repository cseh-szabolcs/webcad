/* stimulusFetch: 'lazy' */
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';
import { on } from "../../../scripts/event.js";

/* The customer list, pages from the backend (remoteListState). */
const state = (controller, {$watch}) => extend(remoteListState, {
    pageSize: 5,
    sortKey: 'updated',
    sortDirection: 'desc',

    init() {
        super.init();
        this.load();

        on(`app_cmp_context-menu:${controller.contextIdValue}:action`, ({item, action}) => {
            this.handleContextMenuAction(item, action);
        });
    },

    /** The search goes to the backend as filter[search]. */
    applyFilterSearch(text) {
        if (text === (this.filters.search ?? '')) {
            return;
        }
        if (text === '') {
            this.removeFilter('search');
        } else {
            this.addFilter('search', text);
        }
    },

    get url() {
        return controller.urlValue;
    },

    handleContextMenuAction(item, action) {
        alert(item + ' : ' + action);
    },

    getContextMenuLabel(label, item) {
        return label.replace('%name%', item.displayName);
    },
});

export default withStateController(state, { url: String, contextId: String });
