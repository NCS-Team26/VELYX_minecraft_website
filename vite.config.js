import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        login: resolve(rootDir, "login.html"),
        status: resolve(rootDir, "status.html"),
        plugins: resolve(rootDir, "plugins.html"),
        stock: resolve(rootDir, "stock.html"),
        rules: resolve(rootDir, "rules.html"),
        join: resolve(rootDir, "join.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "vendor-three";
          if (id.includes("node_modules/lightweight-charts")) return "vendor-charts";
          return undefined;
        },
      },
    },
  },
});
