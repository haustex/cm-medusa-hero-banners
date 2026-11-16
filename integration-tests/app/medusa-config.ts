import { defineConfig } from "@medusajs/framework/utils"

// Test app for the E2E suite. Only started through scripts/guard.mjs, which on
// the Haus Kayu host allows nothing but the rw-spike-* containers and ports 9700+.
// e2e.mjs installs the plugin from its npm pack tarball into node_modules, like a user would
const pluginDir = process.env.HB_PLUGIN_DIR || "medusa-hero-banners"

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    workerMode: "shared",
    http: {
      storeCors: "*",
      adminCors: "*",
      authCors: "*",
      jwtSecret: "hb-e2e-jwt",
      cookieSecret: "hb-e2e-cookie",
    },
  },
  admin: { disable: process.env.HB_ADMIN !== "1", backendUrl: "/" },
  modules: [
    // Uploads through the local provider: files in ./static, served by this server on 9702
    // (the provider's default backend_url would point the URLs at localhost:9000)
    { resolve: "@medusajs/medusa/file", options: { providers: [{ resolve: "@medusajs/medusa/file-local", id: "local", options: { upload_dir: "static", private_upload_dir: "private", backend_url: "http://127.0.0.1:9702/static" } }] } },
  ],
  plugins: [
    {
      resolve: pluginDir,
      options: {
        storefront: { url: "https://storefront.e2e.test", locales: { id: { prefix: "" }, en: { prefix: "/us" } } },
        locales: ["id", "en"],
        placements: ["home", "promo"],
        revalidate: process.env.HB_REVALIDATE_URL ? { url: process.env.HB_REVALIDATE_URL, secret: "e2e-revalidate", delay_ms: 300 } : undefined,
        showCredit: process.env.HB_CREDIT === "1", // off by default, as in the plugin
      },
    },
  ],
})
