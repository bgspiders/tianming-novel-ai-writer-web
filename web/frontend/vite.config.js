import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
const BACKEND = 'http://localhost:38721';
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        host: '127.0.0.1',
        port: 38720,
        strictPort: true,
        open: false,
        proxy: {
            '/api': {
                target: BACKEND,
                changeOrigin: true
            },
            '/hubs': {
                target: BACKEND,
                changeOrigin: true,
                ws: true
            },
            '/swagger': {
                target: BACKEND,
                changeOrigin: true
            }
        }
    },
    build: {
        target: 'es2022',
        sourcemap: false,
        chunkSizeWarningLimit: 1024
    }
});
