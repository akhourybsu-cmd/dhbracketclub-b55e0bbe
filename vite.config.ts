import { defineConfig, type Plugin } from "vite";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const BUILD_ID = Date.now().toString();

// Public, non-secret provenance for the separately published chapter. This is
// emitted by the actual build, rather than a commit claimed by release notes.
function mesomonBuildProvenance(): Plugin {
  return {
    name: "mesomon-build-provenance",
    apply: "build",
    generateBundle() {
      const artManifest = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "public/games/mesomon/manifest.json"), "utf8"),
      );
      if (!Number.isSafeInteger(artManifest.version) || artManifest.version < 1) {
        throw new Error("The Mesomon art manifest needs a positive integer version.");
      }
      let sourceSha: string | null = null;
      let sourceDirty: boolean | null = null;
      try {
        const sha = execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (/^[a-f0-9]{40}$/.test(sha)) sourceSha = sha;
        sourceDirty =
          execFileSync("git", ["status", "--porcelain"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim().length > 0;
      } catch {
        /* Hosting without Git metadata reports unknown, never a guessed SHA. */
      }
      this.emitFile({
        type: "asset",
        fileName: "games/mesomon/release.json",
        source:
          JSON.stringify({
            schema_version: 1,
            chapter: "port-marche",
            rules_version: 1,
            assets_version: artManifest.version,
            source_sha: sourceSha,
            source_dirty: sourceDirty,
            build_id: BUILD_ID,
          }) + "\n",
      });
    },
  };
}

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
    port: parseInt(process.env.PORT || "8080", 10),
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "::",
    port: parseInt(process.env.PORT || "4173", 10),
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    emitVersionJson(),
    mesomonBuildProvenance(),
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
          if (
            id.includes("@supabase") ||
            id.includes("/realtime-js/") ||
            id.includes("/postgrest-js/") ||
            id.includes("/gotrue-js/") ||
            id.includes("/storage-js/")
          ) {
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
