<p align="center">
  <a href="https://hauskayu.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
      <img src="docs/logo.svg" alt="Haus Kayu" width="260">
    </picture>
  </a>
</p>

# medusa-hero-banners

**The hero slider of your home page, managed in the Medusa Admin.** Each banner has a wide photo for desktops
(12:5) and a tall one for phones (4:5), uploaded through Medusa's File Module with a focal point, a headline, a
line of text and a button, in every language of your store; drag-and-drop order, on/off, a schedule, several
placements, a typed Store API and a storefront integration for [Kiln](https://github.com/haustex/sf-medusa-kiln).
<br>Slider hero beranda yang diatur dari Admin Medusa: foto desktop dan HP dengan titik fokus, judul, teks, tombol
per bahasa, urutan drag-and-drop, jadwal tampil, Store API bertipe.

[![npm](https://img.shields.io/npm/v/medusa-hero-banners)](https://www.npmjs.com/package/medusa-hero-banners)
[![CI](https://github.com/haustex/cm-medusa-hero-banners/actions/workflows/ci.yml/badge.svg)](https://github.com/haustex/cm-medusa-hero-banners/actions/workflows/ci.yml)
[![Medusa](https://img.shields.io/badge/Medusa-2.19%20%E2%80%93%202.22-7c3aed)](https://medusajs.com)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

### Compatibility

| Plugin | Medusa | Node | Tested in CI on |
| --- | --- | --- | --- |
| 0.1.x | 2.19.0 or newer 2.x (`^2.19.0`) | 20.19+ or 22.12+ | Medusa 2.19.0 and 2.22.2 |

No other service needed: images go through Medusa's File Module, whichever provider the project uses (local, S3,
R2, …).

### Quick start

```bash
npm install medusa-hero-banners
```

```ts
// medusa-config.ts
plugins: [
  {
    resolve: "medusa-hero-banners",
    options: {
      storefront: {
        url: "https://your-store.com",                 // the Admin's "leads to" links
        locales: { id: { prefix: "" }, en: { prefix: "/us" } },
      },
      locales: ["id", "en"],                           // languages a new banner starts with
      revalidate: { url: "https://your-store.com/api/revalidate", secret: process.env.REVALIDATE_SECRET },
    },
  },
],
```

```bash
npx medusa db:migrate
```

Open **Banners** in the Admin sidebar, create a banner, write the texts, upload the two images, switch it on. The
storefront reads `GET /store/hero-banners` and draws the slider.

## What a banner is

| Field | Notes |
| --- | --- |
| Internal name | Only in the Admin. |
| Shown (on/off) | Off keeps the banner without showing it. New banners start off. |
| Order | Drag in the list; `rank` 0 is the first slide. |
| Button link | A storefront path (`/store`, `/categories/boards`, `/custom`) or an absolute `https://` URL. Empty = no button. |
| Schedule | Show from / until (optional). |
| Languages | BCP 47 codes; the first is the default and must have a headline. Visitors asking for `en-GB` get `en`; a banner without text in a language falls back to its default. |
| Text per language | Headline, line of text, button label (empty = the storefront's default), image description (alt). |
| Desktop image | 12:5, e.g. 1920 × 800. Uploads are rotated by EXIF and scaled down to 2400 px wide when larger. |
| Phone image | 4:5, e.g. 840 × 1050. Scaled down to 1200 px wide when larger. |
| Focal point | Click on the preview; the storefront keeps that point visible when it crops. |

Without images a banner is a **text panel**; with one image the storefront uses it for both viewports. Uploads
accept JPEG, PNG, WebP and AVIF (checked by their first bytes, never by the file name), at most 12 MB; SVG is
refused. Replacing or removing an image deletes the previous file, so nothing piles up in the bucket.

## Options

| Option | Default | Notes |
| --- | --- | --- |
| `storefront.url` | – | Public origin of the storefront, for the "leads to" links in the Admin. |
| `storefront.locales` | `{}` | Per locale `{ prefix }` (`""`, `"/us"`) or `{ origin }`. |
| `locales` | `["en"]` | Languages a new banner starts with; the first is the default. |
| `placements` | `["home"]` | Independent sets of banners (a second slider, a promo bar). The storefront asks for one. |
| `revalidate` | – | `{ url, secret?, header? = "x-revalidate-secret", delay_ms? = 2000 }`: changes are batched and sent as `POST { hero_banners: { placements: ["home"] } }`. |
| `showCredit` | `false` | A small "Banners by Haus Kayu" line under the Admin page. |

## Store API

```
GET /store/hero-banners?placement=home&locale=id      (x-publishable-api-key)
```

```json
{
  "placement": "home",
  "banners": [
    {
      "id": "hbnr_…",
      "placement": "home",
      "locale": "id",
      "title": "Custom Furniture & Kerajinan",
      "subtitle": "Dari Jepara, dibuat tangan.",
      "cta": "Belanja sekarang",
      "href": "/store",
      "image": { "desktop": "https://…/hb-desktop-….jpg", "mobile": "https://…/hb-mobile-….jpg" },
      "focus": { "desktop": { "x": 60, "y": 40 }, "mobile": null },
      "alt": "Meja makan jati di workshop",
      "starts_at": null,
      "ends_at": null,
      "updated_at": "2026-11-16T08:00:00.000Z"
    }
  ]
}
```

Only banners that are on and within their schedule, in order. `locale` may also come from the `x-medusa-locale`
header. The answer carries `Cache-Control: public, max-age=60`; with the `revalidate` option the storefront learns
about changes at once.

### Typed SDK

```ts
import Medusa from "@medusajs/js-sdk"
import { heroBannersStore } from "medusa-hero-banners/sdk"

const sdk = new Medusa({ baseUrl, publishableKey })
const { banners } = await heroBannersStore(sdk).list({ placement: "home", locale: "id" })
```

`heroBannersAdmin(sdk)` wraps the Admin routes (`list`, `create`, `update`, `delete`, `reorder`, `upload`,
`removeUpload`, `config`). Only `sdk.client.fetch` is used, so any object with that shape works.

## Admin API

All under `/admin/hero-banners` (session or bearer):

| Route | |
| --- | --- |
| `GET /config` | Non-secret options the Admin adapts to. |
| `GET ?placement=` · `POST` | List one placement (default: the first) · create `{ name, placement?, enabled?, rank?, href?, image_desktop?, image_mobile?, focus?, starts_at?, ends_at?, locales?, translations? }`. |
| `GET /:id` · `POST /:id` · `DELETE /:id` | One banner. A pasted image URL over an upload deletes the upload. |
| `POST /reorder` | `{ ids, placement? }`: listed ids first, the rest keep their order. |
| `POST /:id/upload?slot=desktop\|mobile` · `DELETE` | Multipart field `file`. Answers `{ banner, image: { width, height } }`. |

Rule violations answer `400`/`404`/`413` with `{ code, message, detail }`; codes: `invalid_url`, `invalid_locale`,
`invalid_placement`, `invalid_date`, `invalid_image`, `file_too_large`, `invalid`, `not_found`.

## Storefront

[Kiln](https://github.com/haustex/sf-medusa-kiln) 0.5+ detects the plugin and draws the banners as its home hero
(slide 1 preloaded as the LCP image, the others loaded when idle; swipe, dots, arrow keys, optional autoplay that
pauses on hover and respects `prefers-reduced-motion`); a banner without images becomes a text panel. Any other
storefront: read the Store API, reserve 12:5 / 4:5 boxes so nothing shifts while the photos load, and call your
revalidation from the `revalidate` hook.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). `npm run build && npm run test:e2e` runs the whole suite against a local
Postgres container.

## License

MIT © Haus Kayu
