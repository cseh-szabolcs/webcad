import { withStateController } from '../../scripts/withStateController.js';

const state = (controller, { $el, $nextTick }) => ({
    count: {},
    dataSource: null,
    init() {
        for (const item of $el.querySelectorAll('a[data-tab]')) {
            void this.fetchCount(item.dataset.tab, item.dataset.source);
        }
    },
    async fetchCount(tab, path) {
        const result = await (await fetch(path)).json();

        $nextTick(() => {
            this.count[tab] = result.value;
        });
    },
    getCount(tab) {
        return this.count[tab] || '';
    },
});

export default withStateController(state);
