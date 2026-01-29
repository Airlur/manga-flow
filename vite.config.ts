import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const isContentBuild = process.env.BUILD_TARGET === 'content';

// Chrome 扩展构建配置
// 分两阶段构建：
// 1. BUILD_TARGET=content: 构建 content script (IIFE 格式)
// 2. 默认: 构建 popup 和 service-worker (ES 格式)
export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: isContentBuild, // 只有第一阶段（content）构建时清空
        rollupOptions: isContentBuild ? {
            // Content script 单独构建为 IIFE
            input: fileURLToPath(new URL('./src/content/index.ts', import.meta.url)),
            output: {
                entryFileNames: 'content/index.js',
                format: 'iife',
                inlineDynamicImports: true,
            },
        } : {
            // Popup 和 Service Worker
            input: {
                'background/service-worker': fileURLToPath(new URL('./src/background/service-worker.ts', import.meta.url)),
                'popup/popup': fileURLToPath(new URL('./src/popup/popup.ts', import.meta.url)),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: '[name].[ext]',
                format: 'es',
            },
        },
        sourcemap: true,
        minify: false,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
