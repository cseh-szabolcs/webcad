/**
 * Origin of the backend (API and `/socket.io`), without a trailing slash: `data-backend-host` on
 * `#root` (the Symfony page), else `VITE_BACKEND_HOST` of the build, else '' (the editor's own origin).
 */
export function backendHost(root: HTMLElement | null = document.getElementById('root')): string {
    const host = root?.dataset.backendHost ?? import.meta.env.VITE_BACKEND_HOST ?? '';
    return host.replace(/\/+$/, '');
}
