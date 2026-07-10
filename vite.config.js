import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    // Minecraft atlas JSON is loaded lazily from the login inventory view, not during initial page paint.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        login: resolve(rootDir, "login.html"),
        status: resolve(rootDir, "status.html"),
        economy: resolve(rootDir, "economy.html"),
        // Legacy /plugins.html kept only as a redirect document to /economy.html.
        plugins: resolve(rootDir, "plugins.html"),
        stock: resolve(rootDir, "stock.html"),
        notice: resolve(rootDir, "notice.html"),
        community: resolve(rootDir, "community.html"),
        resources: resolve(rootDir, "resources.html"),
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
