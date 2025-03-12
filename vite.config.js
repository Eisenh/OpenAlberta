import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import fs from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Use HTTPS only in development mode
  const isDev = mode === "development";
  const serverConfig = isDev
    ? {
        https: {
          key: fs.readFileSync("localhost-key.pem"),
          cert: fs.readFileSync("localhost.pem"),
        },
        host: "localhost",
        port: 5173,
      }
    : {};
  return {
    base: "/", // Changed from "/opendataAlberta/" unless you specifically need that path
    define: {
      "process.env": env,
    },
    plugins: [svelte()],
    resolve: {
      alias: {
        $lib: resolve("./src/lib"),
      },
    },
    server: {
      ...serverConfig // Keep existing HTTPS config
    }
  };
});
