import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 8082,
        strictPort: true,
        host: true,
        origin: "http://0.0.0.0:8082",
        proxy: {
            // Same-origin API in dev; set API_PROXY_TARGET=http://localhost:8080 when running on the host
            '/api': {
                target: process.env.API_PROXY_TARGET ?? 'http://nginx',
                changeOrigin: true,
            },
        },
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
