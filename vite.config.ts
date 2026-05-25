import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
    },
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  build: {
    outDir: 'out',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/webview/index.html'),
        uikit: resolve(__dirname, 'src/webview/uikit.html')
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'main.css';
          return assetInfo.name || 'asset';
        },
        manualChunks(id) {
          if (id.includes('shiki') || id.includes('@shikijs') || id.includes('oniguruma')) {
            return 'shiki-vendor';
          }
          if (id.includes('prosemirror') || id.includes('tiptap')) {
            return 'editor-vendor';
          }
        }
      }
    },
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/webview')
    }
  }
});
