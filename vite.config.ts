import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                'content/index': fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
                'background/service-worker': fileURLToPath(new URL('./src/background/service-worker.ts', import.meta.url)),
                'popup/popup': fileURLToPath(new URL('./src/popup/popup.ts', import.meta.url)),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: '[name].[ext]',
            },
        },
        sourcemap: true,
        minify: false, // 开发阶段不压缩，便于调试
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
