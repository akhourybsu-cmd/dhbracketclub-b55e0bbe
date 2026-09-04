import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const BUILD_ID = Date.now().toString();

// Emit /version.json at build time so the running app can probe for new deploys.
function emitVersionJson() {
  return {
    name: "emit-version-json",
    apply: "build" as const,
    closeBundle() {
      try {
        const outDir = path.resolve(__dirname, "dist");
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(
          path.join(outDir, "version.json"),
          JSON.stringify({ buildId: BUILD_ID }) + "\n",
        );
      } catch (e) {
        console.warn("[emit-version-json] failed:", e);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: parseInt(process.env.PORT || '8080', 10),
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "::",
    port: parseInt(process.env.PORT || '4173', 10),
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    emitVersionJson(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the always-needed framework and data client in stable,
        // cacheable files. Route code can change without invalidating these
        // larger dependencies, and the app entry stays quick to parse.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase") || id.includes("/realtime-js/") || id.includes("/postgrest-js/") || id.includes("/gotrue-js/") || id.includes("/storage-js/")) {
            return "vendor-supabase";
          }
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("/scheduler/") ||
            id.includes("framer-motion") ||
            id.includes("@tanstack/react-query")
          ) {
            return "vendor-framework";
          }
          return undefined;
        },
      },
    },
  },
}));
