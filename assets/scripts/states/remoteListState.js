import { extend } from '../extend.js';
import { listState } from './listState.js';

/**
 * A list whose pages (and sorting) come from the backend, built on listState: `items` holds only
 * the current page. Build on it with extend() and give it the URL of the data route:
 *
 *     const state = extend(remoteListState, { pageSize: 50 });
 *     export default withStateController(state);
 *
 *     {{ stimulus_controller('…', { state: { url: path('…') } }) }}
 *
 * The request: GET `url` with `page`, `pageSize` and, when set, `query`, `sort` and `direction` in
 * the query string, marked as XHR (`X-Requested-With`). The answer: JSON
 * `{ items: [ … ], page: <the page returned>, pageSize, total: <number of all items> }`
 * (App\Core\Dto\ListResultDto); the backend brings a page beyond the last one back into range.
 *
 * With `useHistory` (default) the page, the search and the sorting are in the address (`?page=2
 * &query=muster&sort=name&direction=desc`): every page change or sorting is a pushState() entry,
 * Back and Forward load
 * that page again, and a reloaded or shared address opens the same page. Only one list per page
 * may use it, as the parameter names are fixed.
 *
 * Searching is up to the backend, which has to read `query`, and to the state, which calls load()
 * after a new `query`. A state that overrides init() or destroy() must call
 * `remoteListState.init.call(this)` (and destroy).
 */
export const remoteListState = extend(listState, {
    url: '',
    /** Number of all items, from the backend; the last page follows from it. */
    total: 0,
    loading: false,
    /** The message of a failed load, '' otherwise. */
    error: '',
    useHistory: true,
    /** The AbortController of the running request; a new request (or destroy()) aborts it. */
    abortController: null,
    popStateListener: null,

    init() {
        alert("test 11111")
        if (this.useHistory) {
            this.readLocation();
            this.popStateListener = () => {
                this.readLocation();
                this.load();
            };
            window.addEventListener('popstate', this.popStateListener);
        }
        void this.load();
    },

    /** Alpine calls it when the element's state is removed (destroyState()). */
    destroy() {
        if (this.popStateListener) {
            window.removeEventListener('popstate', this.popStateListener);
        }
        this.abortController?.abort();
        this.abortController = null;
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
        listState.sortBy.call(this, key);
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

    /** Takes the page and the sorting from the address; what it lacks gets the default. */
    readLocation() {
        const params = new URLSearchParams(window.location.search);
        this.page = Math.max(1, Number.parseInt(params.get('page') ?? '', 10) || 1);
        this.query = params.get('query') ?? '';
        this.sortKey = params.get('sort') ?? '';
        this.sortDirection = params.get('direction') === 'desc' ? 'desc' : 'asc';
    },

    /**
     * Writes the page and the sorting into `params`; `forRequest` adds the page size and keeps
     * page 1, the address leaves out what is the default.
     */
    writeParams(params, forRequest) {
        for (const name of ['page', 'pageSize', 'query', 'sort', 'direction']) {
            params.delete(name);
        }
        if (forRequest || this.page > 1) {
            params.set('page', String(this.page));
        }
        if (forRequest) {
            params.set('pageSize', String(this.pageSize));
        }
        if (this.query.trim() !== '') {
            params.set('query', this.query.trim());
        }
        if (this.sortKey !== '') {
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
