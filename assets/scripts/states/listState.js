/** Compares texts like people sort them: by the page language, digits as numbers ("2" < "10"). */
const collator = new Intl.Collator(document.documentElement.lang || undefined, { numeric: true });

/**
 * Base state of a list with search, sorting and pagination in the browser: `items` holds the
 * whole list, `filteredItems` the items matching `query`, `sortedItems` those sorted by `sortKey`,
 * the page shows `pageItems` of them. Build on it with extend(), e.g.
 *
 *     const state = extend(listState, { pageSize: 50 });
 *     export default withStateController(state);
 *
 * and set the items from Twig: `stimulus_controller('…', { state: { items: [ … ] } })`; bind the
 * search field with `x-model="query"`, a column header with `x-on:click="sortBy('name')"` and
 * `x-bind:aria-sort="ariaSort('name')"`. `sortKey` is a field of the items (a path like
 * `project.name` works too; '' leaves the order of `items`), `sortDirection` 'asc' or 'desc'.
 * Pages count from 1; a new query or sorting goes back to page 1. After `items` changed (fewer
 * of them), call goToPage(this.page) to bring `page` back into range.
 *
 * A state that overrides init() must call `listState.init.call(this)`. To search other than in
 * all values of an item, override searchText(item) (e.g. `return item.name;`) or matches(); to
 * sort by something else than the field, override sortValue(item, key) or compare(a, b).
 * The getters filter and sort again on every read, which is fine for the lists a page sends along.
 */
export const listState = {
    items: [],
    query: '',
    sortKey: '',
    sortDirection: 'asc',
    page: 1,
    pageSize: 20,

    init() {
        for (const field of ['query', 'sortKey', 'sortDirection']) {
            this.$watch(field, () => {
                this.page = 1;
            });
        }
    },

    /** The items matching `query`; all of them while it is empty. */
    get filteredItems() {
        const terms = this.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length === 0) {
            return this.items;
        }

        return this.items.filter((item) => this.matches(item, terms));
    },

    /** Whether `item` contains every one of the (lower-case) `terms`, case-insensitively. */
    matches(item, terms) {
        const text = this.searchText(item).toLocaleLowerCase();

        return terms.every((term) => text.includes(term));
    },

    /** The text searched in: the item itself, or for an object its values, nested ones too. */
    searchText(item) {
        if (item === null || item === undefined) {
            return '';
        }
        if (typeof item === 'object') {
            return Object.values(item).map((value) => this.searchText(value)).join(' ');
        }

        return String(item);
    },

    /** `filteredItems` sorted by `sortKey` (stable, `items` stays unchanged). */
    get sortedItems() {
        const items = this.filteredItems;
        if (this.sortKey === '') {
            return items;
        }
        const sign = this.sortDirection === 'desc' ? -1 : 1;

        return [...items].sort((a, b) => {
            const valueA = this.sortValue(a, this.sortKey);
            const valueB = this.sortValue(b, this.sortKey);
            // Empty values go last in both directions.
            const emptyA = valueA === null || valueA === undefined || valueA === '';
            const emptyB = valueB === null || valueB === undefined || valueB === '';
            if (emptyA || emptyB) {
                return emptyA - emptyB;
            }

            return sign * this.compare(valueA, valueB);
        });
    },

    /** The value of `item` sorted by: the field `key`, a dotted path for nested ones. */
    sortValue(item, key) {
        return key.split('.').reduce((value, part) => value?.[part], item);
    },

    /** Numbers (and booleans) by value, everything else as text (collator). */
    compare(a, b) {
        const isNumberA = typeof a === 'number' || typeof a === 'boolean';
        const isNumberB = typeof b === 'number' || typeof b === 'boolean';
        if (isNumberA && isNumberB) {
            return a - b;
        }

        return collator.compare(String(a), String(b));
    },

    /** Sorts by `key`; by the same key again turns the direction around. */
    sortBy(key) {
        if (this.sortKey === key) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortKey = key;
            this.sortDirection = 'asc';
        }
    },

    /** The value of a column header's aria-sort for `key`. */
    ariaSort(key) {
        if (this.sortKey !== key) {
            return 'none';
        }

        return this.sortDirection === 'desc' ? 'descending' : 'ascending';
    },

    /** At least 1, so an empty list is page 1 of 1. */
    get pageCount() {
        return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
    },

    get pageItems() {
        const start = (this.page - 1) * this.pageSize;

        return this.sortedItems.slice(start, start + this.pageSize);
    },

    get hasPreviousPage() {
        return this.page > 1;
    },

    get hasNextPage() {
        return this.page < this.pageCount;
    },

    /** Goes to `page`, kept within 1 … pageCount. */
    goToPage(page) {
        this.page = Math.min(Math.max(1, Math.trunc(page)), this.pageCount);
    },

    previousPage() {
        this.goToPage(this.page - 1);
    },

    nextPage() {
        this.goToPage(this.page + 1);
    },
};
