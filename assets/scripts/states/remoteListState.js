import { extend } from '../extend.js';
import { listState } from './listState.js';

/**
 * listState with the pages from the backend: GET `url` as XHR (XhrHandler) with `page`, `pageSize`,
 * `sort`, `direction`, answer App\Core\Dto\ListResultDto (`items` of the page, `page`, `total`). With
 * `useHistory` these are in the address too (Back/Forward, shareable), so only one such list per
 * page. An overriding init() or destroy() must call super.init() / super.destroy().
 */
export const remoteListState = extend(listState, {
    /** Number of all items, from the backend; the last page follows from it. */
    total: 0,
    loading: false,
    /** The message of a failed load, '' otherwise. */
    error: '',
    useHistory: true,
    /** The AbortController of the running request; a new request (or destroy()) aborts it. */
    abortController: null,
    popStateListener: null,
    /** The sorting at the start (state or Twig): what the address leaves out. */
    locationDefaults: null,

    init() {
        this.locationDefaults = {
            sortKey: this.sortKey,
            sortDirection: this.sortDirection,
        };
        if (this.useHistory) {
            this.readLocation();
            this.popStateListener = () => {
                this.readLocation();
                void this.load();
            };
            window.addEventListener('popstate', this.popStateListener);
        }
    },

    /** Alpine calls it when the element's state is removed (destroyState()). */
    destroy() {
        if (this.popStateListener) {
            window.removeEventListener('popstate', this.popStateListener);
        }
        this.abortController?.abort();
        this.abortController = null;
    },

    get url() {
        return '';
    },

    get pageItems() {
        return this.items;
    },

    get pageCount() {
        return Math.max(1, Math.ceil(this.total / this.pageSize));
    },

    goToPage(page) {
        const target = Math.min(Math.max(1, Math.trunc(page)), this.pageCount);
        if (target !== this.page) {
            this.page = target;
            this.navigate();
        }
    },

    sortBy(key) {
        super.sortBy(key);
        this.page = 1;
        this.navigate();
    },

    /** After a change by the user: a new history entry, then the page from the backend. */
    navigate() {
        if (this.useHistory) {
            window.history.pushState(null, '', this.locationAddress());
        }
        void this.load();
    },

    /** Writes the page and the sorting into the current history entry. */
    replaceLocation() {
        if (this.useHistory) {
            window.history.replaceState(null, '', this.locationAddress());
        }
    },

    /** The current address with the page and the sorting of the list. */
    locationAddress() {
        const address = new URL(window.location.href);
        this.writeParams(address.searchParams, false);

        return address;
    },

    /** Takes the page and the sorting from the address; what it lacks gets locationDefaults. */
    readLocation() {
        const params = new URLSearchParams(window.location.search);
        this.page = Math.max(1, Number.parseInt(params.get('page') ?? '', 10) || 1);
        const defaults = this.locationDefaults;
        const direction = params.get('direction');
        this.sortKey = params.get('sort') ?? defaults.sortKey;
        this.sortDirection = ['asc', 'desc'].includes(direction) ? direction : defaults.sortDirection;
    },

    /**
     * Writes the page and the sorting into `params`; `forRequest` adds the page size and keeps
     * page 1, the address leaves out what equals locationDefaults (readLocation() restores it).
     */
    writeParams(params, forRequest) {
        for (const name of ['page', 'pageSize', 'sort', 'direction']) {
            params.delete(name);
        }
        if (forRequest || this.page > 1) {
            params.set('page', String(this.page));
        }
        if (forRequest) {
            params.set('pageSize', String(this.pageSize));
        }
        const defaults = this.locationDefaults;
        const isDefaultSort = this.sortKey === defaults.sortKey
            && this.sortDirection === defaults.sortDirection;
        if (forRequest ? this.sortKey !== '' : !isDefaultSort) {
            params.set('sort', this.sortKey);
            params.set('direction', this.sortDirection);
        }
    },

    /** Loads the current page; a request still running is aborted, its answer never applied. */
    async load() {
        if (!this.url) return;
        this.abortController?.abort();
        const controller = new AbortController();
        this.abortController = controller;
        this.loading = true;
        this.error = '';
        try {
            const address = new URL(this.url, window.location.href);
            this.writeParams(address.searchParams, true);
            const response = await fetch(address, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (controller.signal.aborted) {
                return;
            }
            this.items = data.items;
            this.total = data.total;
            if (data.page !== this.page) {
                // The backend brought the page into range: correct the address, without a new entry.
                this.page = data.page;
                this.replaceLocation();
            }
        } catch (error) {
            // An aborted request rejects with an AbortError: not an error, a newer request runs.
            if (!controller.signal.aborted) {
                this.error = error.message;
            }
        } finally {
            if (!controller.signal.aborted) {
                this.loading = false;
                this.abortController = null;
            }
        }
    },
});
