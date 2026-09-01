import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
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
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['wouter'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-toast'],
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
});
