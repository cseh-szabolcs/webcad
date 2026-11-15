/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Origin of the backend for a build without the Symfony page; empty = the editor's own origin (see backendHost). */
    readonly VITE_BACKEND_HOST?: string;
}
