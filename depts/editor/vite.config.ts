import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 8081,
        strictPort: true,
        host: true,
        origin: "http://0.0.0.0:8081",
    },
    resolve: {
        alias: {
            'app': path.resolve(__dirname, './src'),
        }
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            output: {
                // hash for caching will be handled by symfony!
                entryFileNames: 'editor/[name].js',
                chunkFileNames: 'editor/[name].js',
                assetFileNames: (assetInfo) => {
                    const name = assetInfo.name ?? '';
                    return name.endsWith('.css')
                        ? 'editor/[name][extname]'
                        : 'editor/assets/[name]-[hash][extname]';
                },
            },
        },
    },
})
