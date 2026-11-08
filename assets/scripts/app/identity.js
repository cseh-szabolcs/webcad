import { getColor, getInitials } from 'lettermark';

export function createInitials(name) {
    return getInitials(name, { locale: document.documentElement.lang });
}

/**
 * The color lettermark generates from an id, not a name, so a customer or tag keeps it when
 * renamed. Only its hue counts: the CSS makes the pastel of the theme from it (`--pastel-bg`,
 * `--pastel-ink`).
 */
export function createColor(id) {
    return { '--pastel-color': getColor(id).background }
}

export default {
    createInitials,
    createColor,
}
