// End-to-end check of the plugin inside a real Medusa app (integration-tests/app): fresh database, migrations,
// server on port 9702, then the Admin API (banners, order, placements, uploads with scaling, schedule, locales),
// the Store API (visible banners per placement and locale) and the revalidate hook.
//
// Usage (plugin built first with `npm run build`):
//   docker run -d --name rw-spike-pg -e POSTGRES_PASSWORD=spike -e POSTGRES_DB=rw_spike -p 127.0.0.1:55436:5432 postgres:17-alpine
//   node integration-tests/e2e.mjs
//
// HB_PG_CONTAINER: name of the Postgres container (default rw-spike-pg). HB_KEEP=1 keeps the server running.
// HB_ADMIN=1 also builds the Admin and checks the bundle. Every medusa command goes through scripts/guard.mjs.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = path.resolve(HERE, "..")
const APP_DIR = path.join(HERE, "app")
const STATE_DIR = path.join(HERE, ".state")
const GUARD = path.join(PLUGIN_DIR, "scripts/guard.mjs")
const MEDUSA = path.join(PLUGIN_DIR, "node_modules/.bin/medusa")
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"
const PACKAGE = "medusa-hero-banners"

const DB_NAME = "hb_e2e"
const PG_CONTAINER = process.env.HB_PG_CONTAINER || "rw-spike-pg"
const PORT = 9702
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN = { email: "admin@e2e.test", password: "e2e-password-123" }
const KEEP = process.env.HB_KEEP === "1"
const HOOK_PORT = 9703

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres:spike@127.0.0.1:55436/${DB_NAME}`,
  REDIS_URL: "redis://127.0.0.1:56383",
  PORT: String(PORT),
  HB_PLUGIN_DIR: PACKAGE,
  HB_CREDIT: "1",
  HB_REVALIDATE_URL: `http://127.0.0.1:${HOOK_PORT}/api/revalidate`,
  NODE_ENV: "development",
}
// REDIS_URL only satisfies the guard; the test app uses the in-memory event bus and workflow engine

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: APP_DIR, env, stdio: "inherit", ...opts })
  if (r.status !== 0) throw new Error(`failed: ${cmd} ${args.join(" ")}`)
}
const guarded = (...args) => run("node", [GUARD, MEDUSA, ...args])

/** The only paths this script ever removes: non-empty, absolute, inside integration-tests/ (never the plugin, never /) */
function inside(p) {
  if (!p || !path.isAbsolute(p) || !p.startsWith(HERE + path.sep) || p === HERE) throw new Error(`refusing to remove ${JSON.stringify(p)}: not inside ${HERE}`)
  return p
}
const rmGuarded = (p) => fs.rmSync(inside(p), { recursive: true, force: true })

/** The app gets the plugin the way a user does: the `npm pack` tarball unpacked into app/node_modules */
function installPlugin() {
  const target = path.join(APP_DIR, "node_modules")
  rmGuarded(target)
  fs.mkdirSync(target, { recursive: true })
  for (const entry of fs.readdirSync(path.join(PLUGIN_DIR, "node_modules"))) {
    if ([".package-lock.json", ".cache", ".vite", ".bin", PACKAGE].includes(entry)) continue
    fs.symlinkSync(path.join(PLUGIN_DIR, "node_modules", entry), path.join(target, entry))
  }
  const pack = spawnSync(NPM, ["pack", "--ignore-scripts", "--json", "--pack-destination", STATE_DIR], { cwd: PLUGIN_DIR, encoding: "utf8" })
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`)
  const tgz = path.join(STATE_DIR, JSON.parse(pack.stdout)[0].filename)
  const dest = path.join(target, PACKAGE)
  fs.mkdirSync(dest)
  run("tar", ["-xzf", tgz, "-C", dest, "--strip-components=1"])
  const selfLink = path.join(PLUGIN_DIR, "node_modules", PACKAGE)
  let stat
  try {
    stat = fs.lstatSync(selfLink)
  } catch {}
  if (stat && !stat.isSymbolicLink()) throw new Error(`${selfLink} exists and is not a symlink from an earlier run; remove it by hand`)
  if (stat) fs.unlinkSync(selfLink)
  fs.symlinkSync(dest, selfLink)
}

/** After `medusa build` with the Admin: the bundler could resolve the package */
function checkAdminBuild(serverDir) {
  section("admin build")
  const bundlerPkg = fs.realpathSync(path.join(PLUGIN_DIR, "node_modules/@medusajs/admin-bundler/package.json"))
  let resolved
  try {
    resolved = createRequire(bundlerPkg).resolve(`${PACKAGE}/admin`)
  } catch (e) {
    resolved = String(e.code || e)
  }
  const installed = path.join(APP_DIR, "node_modules", PACKAGE)
  check(`@medusajs/admin-bundler resolves ${PACKAGE}/admin to the installed package`, resolved.startsWith(installed + path.sep), resolved)
  const assets = path.join(serverDir, "public/admin/assets")
  const js = fs.readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n")
  check("Admin bundle contains the plugin's route and strings", /hero-banners/.test(js) && /New banner/.test(js))
}

function psql(sql, db) {
  if (!db) {
    run("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql])
    return ""
  }
  const out = spawnSync("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" })
  if (out.status !== 0) throw new Error(`psql failed: ${out.stderr}`)
  return out.stdout.trim()
}

async function waitForPostgres() {
  const started = Date.now()
  let last = ""
  while (Date.now() - started < 60_000) {
    const q = spawnSync("docker", ["exec", PG_CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-tAc", "select 1"], { encoding: "utf8" })
    if (q.status === 0 && q.stdout.trim() === "1") return
    last = (q.stderr || q.stdout).trim()
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Postgres container "${PG_CONTAINER}" not ready after 60 s (last: ${last || "no answer"}).`)
}

let failures = 0
let passes = 0
function check(name, ok, detail) {
  if (ok) passes++
  else failures++
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok || detail === undefined ? "" : `\n      ${JSON.stringify(detail)?.slice(0, 900)}`}`)
}
const section = (t) => console.log(`\n${t}`)

const ctx = { admin: {}, pk: null, serverDir: APP_DIR }

/** store: publishable key; admin: bearer token */
async function api(method, url, { body, headers = {}, store = false, admin = true } = {}) {
  const h = { ...headers }
  if (body !== undefined) h["content-type"] = "application/json"
  if (store && ctx.pk) h["x-publishable-api-key"] = ctx.pk
  else if (!store && admin && ctx.admin.authorization) h.authorization = ctx.admin.authorization
  const res = await fetch(BASE + url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json, text, headers: res.headers }
}

/** Multipart upload of one image into a banner slot (the Admin sends the same request through the SDK) */
async function upload(id, slot, buf, filename, type = "application/octet-stream") {
  const form = new FormData()
  form.append("file", new Blob([buf], { type }), filename)
  const res = await fetch(`${BASE}/admin/hero-banners/${id}/upload?slot=${slot}`, { method: "POST", headers: { authorization: ctx.admin.authorization }, body: form })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, json }
}
const require_ = createRequire(import.meta.url)
const sharp = require_(path.join(PLUGIN_DIR, "node_modules/sharp"))
/** Test images straight from sharp */
async function images() {
  const small = sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 200, g: 60, b: 30, alpha: 1 } } })
  const wide = sharp({ create: { width: 3000, height: 1250, channels: 3, background: { r: 30, g: 60, b: 200 } } })
  // a "portrait" photo stored landscape with EXIF orientation 6 (rotate 90° clockwise to view)
  const rotated = sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 60, g: 200, b: 30 } } }).jpeg().withMetadata({ orientation: 6 })
  return { png: await small.clone().png().toBuffer(), webp: await small.clone().webp().toBuffer(), avif: await small.clone().avif().toBuffer(), wideJpg: await wide.jpeg().toBuffer(), rotatedJpg: await rotated.toBuffer() }
}
/** Where the test app's local File Module provider writes public files */
const staticFile = (url) => path.join(ctx.serverDir, "static", path.basename(new URL(url).pathname))

async function login() {
  const auth = await api("POST", "/auth/user/emailpass", { body: ADMIN, admin: false })
  if (!auth.json?.token) throw new Error(`login failed: ${JSON.stringify(auth.json)}`)
  ctx.admin = { authorization: `Bearer ${auth.json.token}` }
}

async function setupStore() {
  const sc = (await api("GET", "/admin/sales-channels")).json.sales_channels[0]
  const key = (await api("POST", "/admin/api-keys", { body: { title: "e2e", type: "publishable" } })).json.api_key
  await api("POST", `/admin/api-keys/${key.id}/sales-channels`, { body: { add: [sc.id] } })
  ctx.pk = key.token
}

/** Stand-in for the storefront's revalidate endpoint */
const hooks = []
function startHookServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let data = ""
      req.on("data", (c) => (data += c))
      req.on("end", () => {
        let body
        try {
          body = JSON.parse(data)
        } catch {
          body = data
        }
        hooks.push({ url: req.url, secret: req.headers["x-revalidate-secret"], body })
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ ok: true }))
      })
    })
    server.listen(HOOK_PORT, "127.0.0.1", () => resolve(server))
  })
}
async function waitHook(pred, ms = 4000) {
  const started = Date.now()
  while (Date.now() - started < ms) {
    const hit = hooks.find(pred)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 100))
  }
  return null
}

async function checks() {
  await login()
  await setupStore()
  const B = "/admin/hero-banners"

  section("Config")
  let r = await api("GET", `${B}/config`)
  check("config: credit on (test app), storefront, locales id+en, placements home+promo, revalidate, upload limits", r.status === 200 && r.json.show_credit === true && r.json.storefront_url === "https://storefront.e2e.test" && r.json.locales.join() === "id,en" && r.json.placements.join() === "home,promo" && r.json.revalidate === true && r.json.upload.max_width.desktop === 2400, r.json)

  section("Banners")
  r = await api("GET", B)
  check("no banners yet", r.status === 200 && r.json.banners.length === 0, r.json)
  r = await api("POST", B, { body: { name: "Custom", href: "/custom", secondary_href: "/store", translations: { id: { title: "Custom Furniture & Kerajinan", subtitle: "Dari Jepara", cta: "Belanja sekarang", secondary_cta: "Semua produk" }, en: { title: "Custom Furniture & Crafts", cta: "Shop now" } } } })
  check("banner created: off by default, locales from the options (id default), rank 0, text-only, urls per locale (en under /us)", r.status === 201 && r.json.banner.enabled === false && r.json.banner.locales.join() === "id,en" && r.json.banner.default_locale === "id" && r.json.banner.rank === 0 && r.json.banner.visibility === "hidden" && r.json.banner.image.desktop === null && r.json.banner.urls.id === "https://storefront.e2e.test/custom" && r.json.banner.urls.en === "https://storefront.e2e.test/us/custom", r.json)
  const b1 = r.json.banner
  check("second button: link + label per locale, urls resolved", b1.secondary_href === "/store" && b1.translations.id.secondary_cta === "Semua produk" && b1.secondary_urls.en === "https://storefront.e2e.test/us/store", b1)
  r = await api("POST", B, { body: { name: "Bad", secondary_href: "javascript:x" } })
  check("javascript: second link refused", r.status === 400 && r.json.code === "invalid_url", r.json)
  r = await api("POST", B, { body: { name: "Boards", enabled: true, href: "/categories/talenan", locales: ["id", "EN", "id"], translations: { id: { title: "Talenan & tray kayu jati" } } } })
  check("second banner: enabled, locales deduped, rank 1, en title falls back later", r.status === 201 && r.json.banner.rank === 1 && r.json.banner.locales.join() === "id,en" && r.json.banner.visibility === "live" && r.json.banner.translations.en === undefined, r.json)
  const b2 = r.json.banner
  r = await api("POST", B, { body: { name: "Jepara", enabled: true, href: "https://wa.me/6285111663330", rank: 0, translations: { id: { title: "Furniture custom dari Jepara" }, en: { title: "Custom furniture from Jepara" } } } })
  check("third banner inserted at rank 0; absolute href kept as is", r.status === 201 && r.json.banner.rank === 0 && r.json.banner.urls.en === "https://wa.me/6285111663330", r.json)
  const b3 = r.json.banner
  r = await api("GET", B)
  check("list in order: Jepara, Custom, Boards with ranks 0..2", r.json.banners.map((b) => b.name).join() === "Jepara,Custom,Boards" && r.json.banners.every((b, i) => b.rank === i), r.json.banners.map((b) => [b.rank, b.name]))
  r = await api("POST", B, { body: { name: "" } })
  check("name required", r.status === 400, r.json)
  r = await api("POST", B, { body: { name: "Bad", href: "javascript:alert(1)" } })
  check("javascript: href refused", r.status === 400 && r.json.code === "invalid_url", r.json)
  r = await api("POST", B, { body: { name: "Bad", href: "//evil.com" } })
  check("protocol-relative href refused", r.status === 400 && r.json.code === "invalid_url", r.json)
  r = await api("POST", B, { body: { name: "Bad", image_desktop: "/hero/a.jpg" } })
  check("relative image address refused", r.status === 400 && r.json.code === "invalid_url", r.json)
  r = await api("POST", B, { body: { name: "Bad", placement: "footer" } })
  check("unknown placement refused", r.status === 400 && r.json.code === "invalid_placement", r.json)
  r = await api("POST", B, { body: { name: "Bad", starts_at: "2027-01-02", ends_at: "2027-01-01" } })
  check("end before start refused", r.status === 400 && r.json.code === "invalid_date", r.json)
  r = await api("POST", `${B}/${b1.id}`, { body: { translations: { fr: { title: "Bonjour" } } } })
  check("text in a locale the banner does not have → 400", r.status === 400 && r.json.code === "invalid_locale", r.json)
  r = await api("POST", `${B}/${b1.id}`, { body: { enabled: true, translations: { en: { subtitle: "From Jepara" } } } })
  check("banner updated (enabled, en subtitle; id text kept)", r.status === 200 && r.json.banner.enabled === true && r.json.banner.translations.en.subtitle === "From Jepara" && r.json.banner.translations.id.subtitle === "Dari Jepara", r.json)
  let hook = await waitHook((h) => h.body?.hero_banners?.placements?.includes("home"))
  check("changes → one batched revalidate call { hero_banners: { placements } } with the secret", !!hook && hook.secret === "e2e-revalidate" && hook.url === "/api/revalidate", hooks)
  hooks.length = 0

  section("Order and placements")
  r = await api("POST", `${B}/reorder`, { body: { ids: [b2.id, b1.id] } })
  check("reorder: listed ids first, rest after, ranks 0..n-1", r.status === 200 && r.json.banners.map((b) => b.id).join() === [b2.id, b1.id, b3.id].join() && r.json.banners.every((b, i) => b.rank === i), r.json.banners.map((b) => [b.rank, b.name]))
  r = await api("POST", `${B}/reorder`, { body: { ids: ["hbnr_nope"] } })
  check("reorder with a foreign id → 404", r.status === 404, r.json)
  r = await api("POST", `${B}/${b3.id}`, { body: { rank: 0 } })
  check("rank 0 puts a banner first again", r.json.banner.rank === 0 && (await api("GET", B)).json.banners.map((b) => b.name).join() === "Jepara,Boards,Custom", r.json)
  r = await api("POST", B, { body: { name: "Promo bar", placement: "promo", enabled: true, translations: { id: { title: "Gratis ongkir" } } } })
  const promo = r.json.banner
  check("banner in another placement starts at rank 0 there", r.status === 201 && promo.rank === 0 && promo.placement === "promo", r.json)
  r = await api("GET", `${B}?placement=promo`)
  check("list per placement", r.json.banners.length === 1 && r.json.banners[0].id === promo.id, r.json)
  r = await api("POST", `${B}/${promo.id}`, { body: { placement: "home" } })
  check("moving to another placement: appended last there, both placements renumbered", r.json.banner.placement === "home" && r.json.banner.rank === 3 && (await api("GET", `${B}?placement=promo`)).json.banners.length === 0, r.json)
  hook = await waitHook((h) => h.body?.hero_banners?.placements?.includes("promo"))
  check("the move revalidates both placements", !!hook && hook.body.hero_banners.placements.includes("home"), hooks)
  hooks.length = 0
  await api("POST", `${B}/${promo.id}`, { body: { placement: "promo" } })

  section("Uploads")
  const img = await images()
  r = await upload(b1.id, "desktop", img.wideJpg, "wide.jpg", "image/jpeg")
  check("desktop upload: stored, scaled down to 2400 px wide, 12:5 kept, URL on the banner, owned", r.status === 200 && r.json.image.width === 2400 && r.json.image.height === 1000 && /^http:\/\/127\.0\.0\.1:9702\/static\/(\d+-)?hb-desktop-[a-z0-9]+-[0-9a-f]{8}\.jpg$/.test(r.json.banner.image.desktop ?? "") && r.json.banner.uploads.desktop === true, r.json)
  const desktopUrl = r.json.banner.image.desktop
  check("…the file exists and is smaller than the original", fs.existsSync(staticFile(desktopUrl)) && fs.statSync(staticFile(desktopUrl)).size < img.wideJpg.length, desktopUrl)
  r = await upload(b1.id, "mobile", img.rotatedJpg, "rotated.jpg", "image/jpeg")
  check("phone upload: EXIF orientation applied (900×600 → 600×900), no further scaling", r.status === 200 && r.json.image.width === 600 && r.json.image.height === 900, r.json)
  const mobileUrl = r.json.banner.image.mobile
  r = await upload(b1.id, "desktop", img.png, "small.png", "image/png")
  check("replacing an upload deletes the previous file", r.status === 200 && r.json.banner.image.desktop !== desktopUrl && !fs.existsSync(staticFile(desktopUrl)), r.json)
  const desktopUrl2 = r.json.banner.image.desktop
  r = await upload(b1.id, "desktop", img.webp, "x.webp", "image/webp")
  check("webp accepted", r.status === 200 && r.json.banner.image.desktop.endsWith(".webp"), r.json)
  r = await upload(b1.id, "desktop", img.avif, "x.avif", "image/avif")
  check("avif accepted", r.status === 200 && r.json.banner.image.desktop.endsWith(".avif"), r.json)
  r = await upload(b1.id, "desktop", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "evil.png", "image/png")
  check("SVG with a .png name refused by magic bytes", r.status === 400 && r.json.code === "invalid_image", r.json)
  r = await upload(b1.id, "desktop", Buffer.alloc(13 * 1024 * 1024, 1), "big.jpg", "image/jpeg")
  check("13 MB → 413 file_too_large", r.status === 413 && r.json.code === "file_too_large", r.json)
  r = await fetch(`${BASE}/admin/hero-banners/${b1.id}/upload?slot=logo`, { method: "POST", headers: { authorization: ctx.admin.authorization }, body: new FormData() })
  check("unknown slot → 400", r.status === 400, r.status)
  r = await api("POST", `${B}/${b1.id}`, { body: { focus: { desktop: { x: 80, y: 20 }, mobile: { x: 150, y: -1 } } } })
  check("focal points saved (clamped)", r.json.banner.focus.desktop.x === 80 && r.json.banner.focus.mobile.x === 100 && r.json.banner.focus.mobile.y === 0, r.json.banner.focus)
  const current = (await api("GET", `${B}/${b1.id}`)).json.banner.image.desktop
  r = await api("POST", `${B}/${b1.id}`, { body: { image_desktop: "https://cdn.example.com/hero.jpg" } })
  check("pasting a URL over an upload deletes the upload", r.json.banner.image.desktop === "https://cdn.example.com/hero.jpg" && r.json.banner.uploads.desktop === false && !fs.existsSync(staticFile(current)), r.json.banner)
  r = await api("DELETE", `${B}/${b1.id}/upload?slot=mobile`)
  check("removing the phone image deletes its file and focal point", r.status === 200 && r.json.banner.image.mobile === null && r.json.banner.focus.mobile === null && !fs.existsSync(staticFile(mobileUrl)), r.json.banner)
  void desktopUrl2

  section("Store")
  const inOneHour = new Date(Date.now() + 3600_000).toISOString()
  const anHourAgo = new Date(Date.now() - 3600_000).toISOString()
  r = await api("POST", B, { body: { name: "Soon", enabled: true, starts_at: inOneHour, translations: { id: { title: "Nanti" } } } })
  const soon = r.json.banner
  check("scheduled banner", soon.visibility === "scheduled", r.json)
  r = await api("POST", B, { body: { name: "Gone", enabled: true, ends_at: anHourAgo, translations: { id: { title: "Dulu" } } } })
  const gone = r.json.banner
  check("expired banner", gone.visibility === "expired", r.json)
  r = await api("GET", "/store/hero-banners", { store: true })
  check("store (default placement home, default locale): the three live banners in order, no hidden/scheduled/expired, cached 60 s", r.status === 200 && r.json.placement === "home" && r.json.banners.map((b) => b.id).join() === [b3.id, b2.id, b1.id].join() && r.headers.get("cache-control") === "public, max-age=60", r.json)
  const S = r.json.banners
  check("text in id: title, subtitle, cta; href as stored; image + focus; null cta where none", S[2].title === "Custom Furniture & Kerajinan" && S[2].subtitle === "Dari Jepara" && S[2].cta === "Belanja sekarang" && S[2].href === "/custom" && S[2].image.desktop === "https://cdn.example.com/hero.jpg" && S[2].image.mobile === null && S[2].focus.desktop.x === 80 && S[1].cta === null && S[0].href === "https://wa.me/6285111663330", S)
  check("second button in the store answer only where link and label exist (id yes, en no)", S[2].secondary?.href === "/store" && S[2].secondary.cta === "Semua produk" && S[1].secondary === null && (await api("GET", "/store/hero-banners?locale=en", { store: true })).json.banners[2].secondary === null, S[2].secondary)
  r = await api("GET", "/store/hero-banners?locale=en-GB", { store: true })
  check("en-GB → en; a banner without en text falls back to its default locale", r.json.banners[2].title === "Custom Furniture & Crafts" && r.json.banners[2].subtitle === "From Jepara" && r.json.banners[2].locale === "en" && r.json.banners[1].title === "Talenan & tray kayu jati" && r.json.banners[1].locale === "id", r.json.banners.map((b) => [b.locale, b.title]))
  r = await api("GET", "/store/hero-banners", { store: true, headers: { "x-medusa-locale": "en" } })
  check("x-medusa-locale header works too", r.json.banners[0].title === "Custom furniture from Jepara", r.json.banners[0])
  r = await api("GET", "/store/hero-banners?placement=promo", { store: true })
  check("other placement", r.json.banners.length === 1 && r.json.banners[0].title === "Gratis ongkir", r.json)
  r = await api("GET", "/store/hero-banners?placement=nope", { store: true })
  check("unknown placement → empty list", r.status === 200 && r.json.banners.length === 0, r.json)
  r = await api("GET", "/store/hero-banners")
  check("store route needs the publishable key", r.status === 400 || r.status === 401, r.status)
  await api("POST", `${B}/${b2.id}`, { body: { enabled: false } })
  r = await api("GET", "/store/hero-banners", { store: true })
  check("switching a banner off removes it from the store", r.json.banners.length === 2 && !r.json.banners.some((b) => b.id === b2.id), r.json.banners.map((b) => b.title))
  void soon
  void gone

  section("Delete")
  const b1Image = (await api("GET", `${B}/${b1.id}`)).json.banner
  await upload(b1.id, "mobile", img.png, "m.png", "image/png")
  const mobileFile = (await api("GET", `${B}/${b1.id}`)).json.banner.image.mobile
  hooks.length = 0
  r = await api("DELETE", `${B}/${b1.id}`)
  check("banner deleted with its upload; the rest renumbered", r.status === 200 && r.json.deleted === true && !fs.existsSync(staticFile(mobileFile)) && (await api("GET", B)).json.banners.every((b, i) => b.rank === i), r.json)
  r = await api("GET", `${B}/${b1.id}`)
  check("…admin view 404", r.status === 404, r.status)
  hook = await waitHook((h) => h.body?.hero_banners?.placements?.includes("home"))
  check("…revalidate for its placement", !!hook, hooks)
  void b1Image
}

async function main() {
  if (!fs.existsSync(path.join(PLUGIN_DIR, ".medusa/server/src/modules/hero-banners/index.js"))) {
    throw new Error("Build the plugin first: npm run build")
  }
  rmGuarded(STATE_DIR)
  fs.mkdirSync(STATE_DIR, { recursive: true })
  installPlugin()
  await waitForPostgres()
  psql(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`)
  psql(`CREATE DATABASE ${DB_NAME}`)
  guarded("db:migrate")
  guarded("user", "-e", ADMIN.email, "-p", ADMIN.password)

  let serverDir = APP_DIR
  if (process.env.HB_ADMIN === "1") {
    guarded("build")
    serverDir = path.join(APP_DIR, ".medusa/server")
    ctx.serverDir = serverDir
    rmGuarded(path.join(serverDir, "node_modules"))
    fs.symlinkSync(path.join(APP_DIR, "node_modules"), path.join(serverDir, "node_modules"))
    checkAdminBuild(serverDir)
  }
  const hookServer = await startHookServer()
  const log = fs.openSync(path.join(STATE_DIR, "server.log"), "w")
  const server = spawn("node", [GUARD, MEDUSA, "start"], { cwd: serverDir, env, stdio: ["ignore", log, log], detached: true })
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break
      } catch {}
      if (i > 120) throw new Error("server did not start, see integration-tests/.state/server.log")
      await new Promise((r) => setTimeout(r, 1000))
    }
    await checks()
    if (KEEP) {
      fs.writeFileSync(path.join(STATE_DIR, "server.pid"), String(server.pid))
      console.log(`\nserver kept running on ${BASE} (pid ${server.pid}); stop with: kill -- -${server.pid}`)
      console.log(`\n${passes} passed, ${failures} failed`)
      process.exit(failures ? 1 : 0)
    }
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {}
    hookServer.close()
  }
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
