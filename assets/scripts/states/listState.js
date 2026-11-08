/** Compares texts like people sort them: by the page language, digits as numbers ("2" < "10"). */
const collator = new Intl.Collator(document.documentElement.lang || undefined, { numeric: true });

/**
 * A list with sorting (`sortKey`, may be a path like `project.name`) and pages (from 1) in the
 * browser, items set from Twig; filters belong to the lists that need them. A new sorting goes back
 * to page 1; after `items` shrank, call goToPage(this.page). An overriding init() must call
 * super.init(); sortValue() and compare() are meant to be overridden.
 */
export const listState = {
    items: [],
    sortKey: '',
    sortDirection: 'asc',
    page: 1,
    pageSize: 20,
    /** Pages shown on each side of the current one in `pageLinks`. */
    pageLinkRadius: 2,

    init() {
        for (const field of ['sortKey', 'sortDirection']) {
            this.$watch(field, () => {
                this.page = 1;
            });
        }
    },

    /** This will be called by a select-input which should contain the key and the direction like 'foo:asc' */
    applySortString(value) {
        const values = value.split(':');
        if (values.length === 2) {
            this.sortKey = values[0];
            this.sortDirection = values[1];
        }
    },

    /** `items` sorted by `sortKey` (stable, `items` stays unchanged). */
    get sortedItems() {
        const items = this.items;
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
        return Math.max(1, Math.ceil(this.items.length / this.pageSize));
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

    /**
     * Page links like `1 … 6 7 8 9 10 … 20` (`page: null` is a gap), always the same number of
     * entries, so the links don't move under the pointer. `key` is for x-for.
     */
    get pageLinks() {
        const count = this.pageCount;
        const radius = this.pageLinkRadius;
        const slots = 2 * radius + 5;
        const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

        let pages;
        if (count <= slots) {
            pages = range(1, count);
        } else if (this.page <= radius + 3) {
            pages = [...range(1, slots - 2), null, count];
        } else if (this.page >= count - radius - 2) {
            pages = [1, null, ...range(count - slots + 3, count)];
        } else {
            pages = [1, null, ...range(this.page - radius, this.page + radius), null, count];
        }

        return pages.map((page, index) => ({
            key: page ?? (index === 1 ? 'gap-start' : 'gap-end'),
            page,
            current: page === this.page,
        }));
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
