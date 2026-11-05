const locale = document.documentElement.lang || undefined;
const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
/** "heute", "gestern": only for these two, as with `auto` also "letzten Monat" would follow. */
const nearDayFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });

const DAY = 24 * 60 * 60 * 1000;

/** A date as text, e.g. 05.11.2026. */
export function formatDate(value) {
    return dateFormat.format(new Date(value));
}

/**
 * How long ago a date was, counted in calendar days of the viewer: "Heute", "Gestern",
 * "vor 3 Tagen", from 30 days on in months, from 365 days on in years. A date in the future
 * (a clock running behind the server's) counts as today.
 */
export function formatRelativeDay(value, now = new Date()) {
    const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(new Date(value))) / DAY));
    if (days < 2) {
        const text = nearDayFormat.format(-days, 'day');

        return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
    }
    if (days < 30) {
        return relativeFormat.format(-days, 'day');
    }
    if (days < 365) {
        return relativeFormat.format(-Math.floor(days / 30), 'month');
    }

    return relativeFormat.format(-Math.floor(days / 365), 'year');
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
