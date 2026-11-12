import type { GripAction } from 'app/cad/editor/grips/actions';
import type { Point } from 'app/cad/model/Point';
import { t } from 'app/i18n/i18n';

/** What the menu shows: its grip in view px (CSS pixels relative to the canvas) and the actions. */
export interface GripMenuDisplay {
    at: Point;
    actions: readonly GripAction[];
}

/** From the grip's centre to the menu's corner in px: close enough that the way there stays on the grip. */
const MENU_OFFSET_PX = 6;
/**
 * Invisible margin around the menu that takes the pointer too, so the way from the grip to the
 * menu need not be exact. Must match the padding of `.grip-menu`. The corner over the grip is
 * left out, so the grip can still be clicked.
 */
const MENU_REACH_PX = 16;

/**
 * The menu of a grip, like AutoCAD's multifunctional grip menu: a DOM list over the canvas, just
 * below and right of the grip, flipped at the canvas edge. Unlike the other canvas layers it
 * takes the pointer, also in an invisible margin around it (MENU_REACH_PX); a click on an entry
 * reports its action.
 */
export class GripMenu {
    private readonly container: HTMLElement;
    private readonly root: HTMLDivElement;
    private readonly panel: HTMLDivElement;
    private readonly onChoose: (action: GripAction) => void;
    /** The actions and the language the entries were last built for. */
    private built = '';

    constructor(container: HTMLElement, onChoose: (action: GripAction) => void) {
        this.container = container;
        this.onChoose = onChoose;
        this.root = document.createElement('div');
        this.root.className = 'grip-menu';
        this.root.hidden = true;
        this.panel = document.createElement('div');
        this.panel.className = 'grip-menu-panel';
        this.panel.setAttribute('role', 'menu');
        this.root.appendChild(this.panel);
        // Keeps the focus where it is, so the keys go on to the editor
        this.root.addEventListener('mousedown', (event) => event.preventDefault());
        // The browser menu has no place here either
        this.root.addEventListener('contextmenu', (event) => event.preventDefault());
        container.appendChild(this.root);
    }

    /** Shows the menu at the grip, or hides it with null. */
    show(menu: GripMenuDisplay | null): void {
        this.root.hidden = menu === null;
        if (menu === null) {
            return;
        }
        const key = `${t('gripAction.menu')}|${menu.actions.join(',')}`;
        if (key !== this.built) {
            this.built = key;
            this.panel.setAttribute('aria-label', t('gripAction.menu'));
            this.panel.replaceChildren(...menu.actions.map((action) => this.entry(action)));
        }
        // Measured after the entries are in, to stay inside the canvas; the root is the panel with its margin
        const reach = MENU_REACH_PX;
        const { offsetWidth: width, offsetHeight: height } = this.root;
        const { clientWidth, clientHeight } = this.container;
        const flipX = menu.at.x + MENU_OFFSET_PX + width - 2 * reach > clientWidth;
        const flipY = menu.at.y + MENU_OFFSET_PX + height - 2 * reach > clientHeight;
        const x = flipX ? menu.at.x - MENU_OFFSET_PX + reach - width : menu.at.x + MENU_OFFSET_PX - reach;
        const y = flipY ? menu.at.y - MENU_OFFSET_PX + reach - height : menu.at.y + MENU_OFFSET_PX - reach;
        this.root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        // The margin's corner over the grip takes no pointer
        const x0 = flipX ? width - reach : 0;
        const y0 = flipY ? height - reach : 0;
        const corner = `${x0}px ${y0}px, ${x0 + reach}px ${y0}px, ${x0 + reach}px ${y0 + reach}px, ${x0}px ${y0 + reach}px, ${x0}px ${y0}px`;
        this.root.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${corner})`;
    }

    dispose(): void {
        this.root.remove();
    }

    private entry(action: GripAction): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'grip-menu-item';
        button.setAttribute('role', 'menuitem');
        button.textContent = t(`gripAction.${action}`);
        button.addEventListener('click', () => this.onChoose(action));
        return button;
    }
}
