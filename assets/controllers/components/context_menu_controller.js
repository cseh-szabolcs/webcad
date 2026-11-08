import { withStateController } from '../../scripts/withStateController.js';
import event from '../../scripts/event.js';

const state = {
    id: null,
    init() {
        this.id && event.on(`app_cmp_context-menu:${this.id}`, ({element, item = null}) => {
            this.handleMenuClick(element, item);
        });
    },
    handleMenuClick(triggerElement, item) {
        this.item = item;
        if (!this.visible) {
            setPosition(this['$element'], triggerElement);
        }
    },
    handleAction(action) {
        event.dispatch(`app_cmp_context-menu:${this.id}:action`, {
            action,
            item: this.item,
        });
    },
    closeMenu() {
        this.visible && this['$element'].hidePopover();
    },
    get visible() {
        return this['$element']?.matches(':popover-open');
    },
};

/**
 * Places the row menu at its button, before the button's `popovertarget` opens it. The menu
 * is a popover, as the scrolling table would cut off anything positioned inside of it.
 */
function setPosition(layer, button) {
    const rect = button.getBoundingClientRect();
    const { style } = layer;
    const opensUpwards = rect.bottom + MENU_HEIGHT > window.innerHeight;
    style.right = `${document.documentElement.clientWidth - rect.right}px`;
    style.top = opensUpwards ? 'auto' : `${rect.bottom + 4}px`;
    style.bottom = opensUpwards ? `${window.innerHeight - rect.top + 4}px` : 'auto';
}

const MENU_HEIGHT = 140;

export default withStateController(state);
