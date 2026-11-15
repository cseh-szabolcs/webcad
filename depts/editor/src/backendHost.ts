/**
 * Origin of the backend (API and `/socket.io`), without a trailing slash: `data-backend-host` on
 * `#root` (the Symfony page), else `VITE_BACKEND_HOST` of the build, else '' (the editor's own origin).
 */
export function backendHost(root: HTMLElement | null = document.getElementById('root')): string {
    const host = root?.dataset.backendHost ?? import.meta.env.VITE_BACKEND_HOST ?? '';
    return host.replace(/\/+$/, '');
}

/**
 * Where the Exit button leads: the plan list on the backend host. The Symfony page names its
 * localized path with `data-exit-path`, without one it is `/de/plans`.
 */
export function exitUrl(root: HTMLElement | null = document.getElementById('root')): string {
    return backendHost(root) + (root?.dataset.exitPath || '/de/plans');
}
