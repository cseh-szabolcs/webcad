import { withStateController } from '../../scripts/withStateController.js';
import event from '../../scripts/event.js';

const state = {
    activeTab: null,
    dataSource: null,
    init() {
        this['$watch']('dataSource', () => {
            event.dispatch('app.cmp.segmentTabs:change', {
                key: this.activeTab,
                dataSource: this.dataSource,
            });
        });

        queueMicrotask(() => {
            const active = this.$element.querySelectorAll('a[aria-current="page"]')[0] ?? null;
            active && this.selectTab(active);
        });
    },
    selectTab(element) {
        this.activeTab = element.dataset.key;
        this.dataSource = element.dataset.source;
    },
    isActive(key) {
        return this.activeTab === key;
    },
    getCount(key) {

    },
};

export default withStateController(state);
