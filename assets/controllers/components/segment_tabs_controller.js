import { withStateController } from '../../scripts/withStateController.js';

const state = (_, { $el, $nextTick }) => ({
    count: {},
    dataSource: null,
    init() {
        for (const item of $el.querySelectorAll('a[data-tab]')) {
            void this.fetchCount(item.dataset.tab, item.dataset.source);
        }
    },
    async fetchCount(tab, path) {
        this.restore(tab);
        const result = await (await fetch(path)).json();

        $nextTick(() => {
            this.count[tab] = result.value;
            localStorage.setItem(`webcat.tab_count.${tab}`, this.count[tab]);
        });
    },
    getCount(tab) {
        return this.count[tab] || '';
    },

    restore(tab) {
        const existing = localStorage.getItem(`webcat.tab_count.${tab}`);
        if (existing) {
            this.count[tab] = existing;
        }
    },
});

export default withStateController(state);
