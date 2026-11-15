/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Origin of the backend for a build without the Symfony page; empty = the editor's own origin (see backendHost). */
    readonly VITE_BACKEND_HOST?: string;
    /** Extra wait in ms before the loaded plan replaces the skeleton (see loadingDelay). */
    readonly VITE_LOADING_DELAY_MS?: string;
    /** Light or dark mode until the browser remembers a choice (see defaultTheme). */
    readonly VITE_THEME?: string;
}
