/* stimulusFetch: 'lazy' */
import { withStateController } from '../../../scripts/withStateController.js';

/*
 * The counts in the tabs of the customer area (templates/page/customer/_tabs.html.twig): each one
 * is the `total` of that list's data route. A count that cannot be loaded leaves its badge hidden,
 * the tab itself is a plain link and works without it.
 */
const state = {
    /** The data route of each tab, by the tab's key. */
    urls: {},
    /** The number of items of each tab, by the tab's key. */
    counts: {},
    abortController: null,

    init() {
        const controller = new AbortController();
        this.abortController = controller;
        for (const [key, url] of Object.entries(this.urls)) {
            this.loadCount(key, url, controller.signal);
        }
    },

    /** Alpine calls it when the element's state is removed (destroyState()). */
    destroy() {
        this.abortController?.abort();
        this.abortController = null;
    },

    async loadCount(key, url, signal) {
        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                signal,
            });
            if (response.ok) {
                const data = await response.json();
                this.counts[key] = data.total;
            }
        } catch {
            // Aborted or offline: the badge stays hidden.
        }
    },
};

export default withStateController(state);
