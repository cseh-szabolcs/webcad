import { Controller } from '@hotwired/stimulus';

/*
 * Light/dark mode of the pages for logged-in users. "light" and "dark" are stored in the cookie
 * "theme", which templates/app.html.twig reads to render <html data-theme>; "system" deletes the
 * cookie, so the CSS follows prefers-color-scheme. The choice applies to the open page at once.
 */
const COOKIE = 'theme';
const MAX_AGE = 60 * 60 * 24 * 365;

export default class extends Controller {
    static targets = ['option'];

    connect() {
        this.mark(document.documentElement.dataset.theme ?? 'system');
    }

    choose(event) {
        const theme = event.currentTarget.dataset.themeChoice;

        if (theme === 'light' || theme === 'dark') {
            document.cookie = `${COOKIE}=${theme}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
            document.documentElement.dataset.theme = theme;
        } else if (theme === 'system') {
            document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
            delete document.documentElement.dataset.theme;
        } else {
            return;
        }

        this.mark(theme);
    }

    mark(theme) {
        this.optionTargets.forEach((option) => {
            option.setAttribute('aria-pressed', String(option.dataset.themeChoice === theme));
        });
    }
}
