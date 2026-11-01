import { Controller } from '@hotwired/stimulus';

/*
 * Closes a <details> menu on a click outside of it and on Escape (opening and closing by click
 * is the element's own behaviour, so the menu works without JavaScript too).
 */
export default class extends Controller {
    connect() {
        this.onClick = (event) => {
            if (this.element.open && !this.element.contains(event.target)) {
                this.element.open = false;
            }
        };
        this.onKeydown = (event) => {
            if (event.key === 'Escape' && this.element.open) {
                this.element.open = false;
                this.element.querySelector('summary')?.focus();
            }
        };
        document.addEventListener('click', this.onClick);
        document.addEventListener('keydown', this.onKeydown);
    }

    disconnect() {
        document.removeEventListener('click', this.onClick);
        document.removeEventListener('keydown', this.onKeydown);
    }
}
