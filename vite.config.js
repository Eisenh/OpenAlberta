import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import fs from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDev = mode === "development";

  // HTTPS settings for dev mode
  const serverConfig = isDev
    ? {
        https: {
          key: fs.readFileSync("localhost-key.pem"),
          cert: fs.readFileSync("localhost.pem"),
        },
        host: "localhost",
        port: 5173,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        fs: {
          strict: false, // Allow accessing `public/` directly
          allow: ['.']
        },
      }
    : {};

  return {
    base: '/OpenAlberta',
    publicDir: 'public',
    define: {
      // This ensures environment variables are properly replaced during build
      "process.env": {
        ...env,
        GITHUB_PAGES: mode === 'production',
      },
    },
    plugins: [svelte()],
    resolve: {
      alias: {
        $lib: resolve("./src/lib"),
        $stores: resolve("./src/lib/stores"),
      },
    },
    server: {
      ...serverConfig,
      open: true, // Automatically open browser on dev start
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
        },
      },
    },
  };
});
