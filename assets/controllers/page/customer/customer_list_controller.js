/* stimulusFetch: 'lazy' */
import { getColor, getInitials } from 'lettermark';
import { formatDate, formatRelativeDay } from '../../../scripts/date.js';
import { extend } from '../../../scripts/extend.js';
import { remoteListState } from '../../../scripts/states/remoteListState.js';
import { withStateController } from '../../../scripts/withStateController.js';

/*
 * The customer list (templates/page/customer/list.html.twig): search, tag filter and sorting go to
 * the backend, the selected customer opens the detail view. All of it is in the address, the
 * selection as `?customer=<id>`, which replaces the history entry: selecting is no navigation.
 */
const DEFAULT_SORT = 'updated';
const DEFAULT_DIRECTION = 'desc';

/** The colors of the tags the offices use most; every other tag gets a generated one. */
const TAG_TONES = {
    Bauträger: 'blue',
    Stammkunde: 'green',
    Öffentlich: 'orange',
    Bauherr: 'purple',
};
const MENU_HEIGHT = 140;

const state = extend(remoteListState, {
    /** The route of the tags for the filter. */
    tagsUrl: '',
    /** Translated texts, from Twig. */
    texts: {},
    /** The tags of the filter: `{ id, name }`. */
    tagOptions: [],
    /** The id of the tag filtered by, '' for all. */
    tag: '',
    sortKey: DEFAULT_SORT,
    sortDirection: DEFAULT_DIRECTION,
    selectedId: null,
    /** The selected customer, if it is not on the current page. */
    detailItem: null,

    init() {
        remoteListState.init.call(this);
        this.loadTagOptions();
    },

    readLocation() {
        remoteListState.readLocation.call(this);
        const params = new URLSearchParams(window.location.search);
        if (this.sortKey === '') {
            this.sortKey = DEFAULT_SORT;
            this.sortDirection = DEFAULT_DIRECTION;
        }
        this.tag = params.get('tag') ?? '';
        this.selectedId = params.get('customer');
    },

    writeParams(params, forRequest) {
        remoteListState.writeParams.call(this, params, forRequest);
        params.delete('tag');
        params.delete('customer');
        if (this.tag !== '') {
            params.set('tag', this.tag);
        }
        if (forRequest) {
            return;
        }
        if (this.selectedId !== null) {
            params.set('customer', this.selectedId);
        }
        if (this.sortKey === DEFAULT_SORT && this.sortDirection === DEFAULT_DIRECTION) {
            params.delete('sort');
            params.delete('direction');
        }
    },

    async load() {
        await remoteListState.load.call(this);
        if (!this.loading) {
            this.loadSelected();
        }
    },

    /** Fetches the selected customer if the list does not contain it; an unknown one is deselected. */
    async loadSelected() {
        const id = this.selectedId;
        if (id === null || this.selected !== null) {
            return;
        }
        try {
            const response = await fetch(`${this.url}/${id}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (this.selectedId !== id) {
                return;
            }
            if (response.ok) {
                this.detailItem = await response.json();
            } else {
                this.selectedId = null;
                this.replaceLocation();
            }
        } catch {
            // Offline: the list shows no selection, the address keeps it for the next reload.
        }
    },

    async loadTagOptions() {
        try {
            const response = await fetch(this.tagsUrl, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (response.ok) {
                this.tagOptions = (await response.json()).items;
            }
        } catch {
            // The filter then only offers all tags.
        }
    },

    /** After typing: no new history entry for every word. */
    search() {
        this.page = 1;
        this.replaceLocation();
        this.load();
    },

    filterByTag() {
        this.page = 1;
        this.navigate();
    },

    /** The sorting as the value of its select, e.g. `updated:desc`. */
    get sortOption() {
        return `${this.sortKey}:${this.sortDirection}`;
    },

    set sortOption(value) {
        [this.sortKey, this.sortDirection] = value.split(':');
        this.page = 1;
        this.navigate();
    },

    get hasFilter() {
        return this.query.trim() !== '' || this.tag !== '';
    },

    get countLabel() {
        const text = this.total === 1 ? this.texts.countOne : this.texts.countOther;

        return text.replace('%count%', this.total);
    },

    get selected() {
        if (this.selectedId === null) {
            return null;
        }
        const item = this.items.find(({ id }) => id === this.selectedId);
        if (item) {
            return item;
        }

        return this.detailItem?.id === this.selectedId ? this.detailItem : null;
    },

    select(id) {
        const root = this.$root;
        this.selectedId = id;
        // Stays in the view when a search takes the customer off the page.
        this.detailItem = this.items.find((item) => item.id === id) ?? null;
        this.replaceLocation();
        // Below the table on a narrow screen, the detail view may be out of sight.
        this.$nextTick(() => root.querySelector('.customer-detail')?.scrollIntoView({ block: 'nearest' }));
    },

    /**
     * Gives the focus back to the row, as the close button goes away with the view. `$root` is
     * read first: it is looked up from the calling element, which the close button then no longer has.
     */
    closeDetail() {
        const id = this.selectedId;
        if (id === null) {
            return;
        }
        const root = this.$root;
        this.selectedId = null;
        this.detailItem = null;
        this.replaceLocation();
        this.$nextTick(() => root.querySelector(`[data-customer="${id}"]`)?.focus());
    },

    /** Escape closes the open menu first (the browser does that), only then the detail view. */
    onEscape() {
        if (!this.$refs.menu.matches(':popover-open')) {
            this.closeDetail();
        }
    },

    /**
     * Places the row menu at its button, before the button's `popovertarget` opens it. The menu
     * is a popover, as the scrolling table would cut off anything positioned inside of it.
     */
    placeMenu(event) {
        const button = event.currentTarget.getBoundingClientRect();
        const { style } = this.$refs.menu;
        const opensUpwards = button.bottom + MENU_HEIGHT > window.innerHeight;
        style.right = `${document.documentElement.clientWidth - button.right}px`;
        style.top = opensUpwards ? 'auto' : `${button.bottom + 4}px`;
        style.bottom = opensUpwards ? `${window.innerHeight - button.top + 4}px` : 'auto';
    },

    closeMenu() {
        if (this.$refs.menu.matches(':popover-open')) {
            this.$refs.menu.hidePopover();
        }
    },

    displayName(item) {
        return [item.firstname, item.lastname].filter(Boolean).join(' ')
            || item.company
            || item.email
            || this.texts.unnamed;
    },

    /** A company itself as the contact, without a person. */
    isCompanyContact(item) {
        return !item.firstname && !item.lastname && Boolean(item.company);
    },

    subtitle(item) {
        if (this.isCompanyContact(item)) {
            return this.texts.companyContact;
        }

        return item.company || this.texts.private;
    },

    initials(item) {
        return getInitials(this.displayName(item), { locale: document.documentElement.lang });
    },

    /** Companies stay neutral: `tone--neutral` wins over the colors of `pastelStyle()`. */
    avatarClass(item) {
        return this.isCompanyContact(item) ? 'tone--neutral customer-avatar--company' : '';
    },

    /**
     * The color lettermark generates from an id, not a name, so a customer or tag keeps it when
     * renamed. Only its hue counts: the CSS makes the pastel of the theme from it (`--pastel-bg`,
     * `--pastel-ink`).
     */
    pastelStyle(id) {
        return { '--pastel-color': getColor(id).background };
    },

    /** A tone of its own wins over the generated color of `pastelStyle()`. */
    tagClass(tag) {
        return tag.name in TAG_TONES ? `tone--${TAG_TONES[tag.name]}` : '';
    },

    actionsLabel(item) {
        return this.texts.actionsFor.replace('%name%', this.displayName(item));
    },

    phoneHref(phone) {
        return `tel:${phone.replace(/[^+\d]/g, '')}`;
    },

    formatDate,
    formatRelativeDay,
});

export default withStateController(state);
