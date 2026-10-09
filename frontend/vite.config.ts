import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "shared"),
    },
  },
  css: {
    postcss: { plugins: [] },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // The SSR build (entry-server.tsx, used only by scripts/prerender.mjs at
  // build time) has no use for a second copy of the public folder.
  publicDir: isSsrBuild ? false : undefined,
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Long-lived vendor code in its own files, so an app deploy does not
        // invalidate it (assets are cached immutably, see vercel.json). The
        // object form of manualChunks silently produced an EMPTY react-vendor
        // chunk and left react-dom in the entry. Radix is no longer grouped:
        // a forced group made every page download the dialog, dropdown and
        // select code that only a few lazy pages use.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/]node_modules[\\/](@supabase[\\/]|iceberg-js)/.test(id)) return 'supabase-vendor';
          if (/[\\/]node_modules[\\/]wouter[\\/]/.test(id)) return 'router-vendor';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'wouter'],
  },
  server: {
    host: "127.0.0.1",
    port: 5412,
    open: "http://127.0.0.1:5412/",
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      // shared/ sits above this package, so fs.strict would refuse to
      // serve it in dev even though the build resolves it fine.
      allow: [path.resolve(import.meta.dirname), path.resolve(import.meta.dirname, "..", "shared")],
      deny: ["**/.*"],
    },
  },
}));
