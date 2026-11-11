import { withStateController } from '../../scripts/withStateController.js';

const state = (controller, { $nextTick }) => ({
    requestProvider: {
        result: null,
        loading: false,
    },
    async init() {
        this.requestProvider.loading = true;
        const result = await (await fetch(controller.pathValue)).json();

        $nextTick(() => {
            this.requestProvider.loading = false;
            this.requestProvider.result = result;
        });
    },
    selectRequestProviderData(selector, expectArray = false) {
        if (this.requestProvider.loading) {
            return expectArray ? [] : null
        }

        if (typeof this.requestProvider.result !== 'object') {
            throw new Error('Call selectRequestProviderData on none object.');
        }

        const data = selector.split(".").reduce((obj, key) => obj?.[key], this.requestProvider.result);
        if (expectArray && !Array.isArray(data)) {
            throw new Error('Call selectRequestProviderData is not an array as expected.');
        }

        return data;
    }
});

export default withStateController(state, {
    path: String,
});
