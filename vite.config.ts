import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // In dev the app is served by Vite and the API by wrangler; proxying keeps
  // them one origin so cookies, websockets and relative URLs all behave as
  // they will in production, where the Worker serves both.
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true, ws: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      /*
       * "prompt", not "autoUpdate". An installed home-screen app has no
       * address bar and no reload button, so an update that needs a reload
       * needs an in-app control to trigger it — see UpdateBar. Shipping
       * autoUpdate without one leaves the app with no reload affordance at
       * all, which is a hole you only notice once something is stuck.
       */
      registerType: "prompt",
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      workbox: {
        /*
         * The default globPatterns covers js/css/html plus manifest-declared
         * icons and nothing else — anything dropped into public/ is silently
         * left out of the precache and simply fails offline.
         */
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        cleanupOutdatedCaches: true,
        /*
         * Claim the page that installed us, so the app is offline-capable
         * after ONE visit rather than two. Without this a player who opens
         * the link at the table and then loses signal has nothing cached.
         * This is independent of skipWaiting, which stays off — an update
         * still waits for the user to press Reload.
         */
        clientsClaim: true,
        skipWaiting: false,
      },
      manifest: {
        name: "Table Companion",
        short_name: "Companion",
        description: "A session companion for D&D played in person.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // No orientation lock: the DM's tablet in landscape is a real case.
        background_color: "#0F1211",
        theme_color: "#0F1211",
        categories: ["games", "utilities"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
