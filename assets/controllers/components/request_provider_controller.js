import { withStateController } from '../../scripts/withStateController.js';

const state = (controller, { $nextTick }) => ({
    providerData: null,
    providerLoading: null,
    parent: null,
    init() {
        this.providerLoading = true;
        void this.fetchData(controller.pathValue, controller.propValue);
    },
    async fetchData(path, prop) {
        const result = await (await fetch(path)).json();

        $nextTick(() => {
            this.providerLoading = false;
            this.providerData = prop ? result[prop] : result;
        });
    },
});

export default withStateController(state, {
    path: String,
    prop: String,
});
