# CLAUDE.md — medusa-hero-banners (home-page hero banners for Medusa v2, by Haus Kayu)

## ⚠️ Server rules (read before doing anything)

This host also runs the **hauskayu.com production store**.

- **Never** send requests to ports `9000`, `8000`, `8001`, `80`, `443`, `5432`, `6379` or any `*.hauskayu.com` domain from tests.
- **Never** touch the `hauskayu-*` containers or the `~/hauskayu` repo from this plugin's work.
- Test **only** on ports `9700+` and the `rw-spike-*` containers (Postgres `127.0.0.1:55436`, Redis `127.0.0.1:56383`).
  This plugin's E2E uses 9702 (server) and 9703 (revalidate stand-in); medusa-link-in-bio uses 9700/9701.
- Every medusa/db command goes **through `scripts/guard.mjs`**.
- Any `rm` (in shell or in a script) is shown to the maintainer first, uses `${VAR:?}` guards and absolute paths
  inside the repo; `integration-tests/e2e.mjs` removes paths only through `rmGuarded()`.
- **Never commit** secrets or `.env` files. Do not publish to npm or push tags until the maintainer (Haus Kayu) says OK.

## Technical decisions

- One module `heroBanners`, tables `hb_banner`, `hb_banner_translation`. **Service keys = DML model names**
  (`HbBanner` → `listHbBanners`, …). Order = `rank` within `placement`; `src/lib/banners.ts` renumbers 0..n-1 after
  every create/move/delete/reorder (only rows whose rank changes are written).
- Links (`cleanHref`): a storefront-relative path (`/store`, never `//host`) or an absolute http(s) URL; image
  addresses absolute only. The storefront resolves paths into its market URLs; the Admin shows "leads to" through
  `storefront.url` + `storefront.locales[locale].prefix|origin` (`src/lib/urls.ts`).
- Uploads (`src/lib/uploads.ts`): multer in memory (`src/api/middlewares.ts`, 413 from the middleware itself),
  magic bytes decide the type, sharp rotates by EXIF and scales down to `MAX_WIDTH[slot]` (desktop 2400, mobile
  1200) in the same format, `Modules.FILE` `createFiles`/`deleteFiles`; the File Module ids the banner owns live in
  `hb_banner.files`. **JSON columns are merged on update** (MikroORM `assign`), so a slot is cleared by writing
  `null`, never by deleting the key (`files`, `focus`).
- Store API answers only visible banners (`isVisible`: enabled + schedule) of one placement, text picked by
  `matchLocale` (exact → same language → default). The storefront is expected to re-fetch within a minute
  (`Cache-Control: public, max-age=60`) and to listen to `revalidate` (`{ hero_banners: { placements } }`).
- Admin: Medusa UI + react-i18next (`src/admin/i18n`), dnd-kit for ordering; the editor's preview is CSS only.
- E2E (`integration-tests/e2e.mjs`): `HB_ADMIN=1` also builds the Admin; placements `home` + `promo` in the test app.

## Backlog

- Admin: a phone-proportion preview next to the desktop one.
- Store: an `updated_at` of the placement for cheap conditional requests.
