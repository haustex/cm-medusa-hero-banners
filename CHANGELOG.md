# Changelog

All notable changes to medusa-hero-banners. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org).

## [0.1.0] — 2026-11-16

First release.

### Added
- Banners managed in the Admin ("Banners" in the sidebar): internal name, on/off, drag-and-drop order, optional
  schedule (show from / until), button link (a storefront path or an absolute URL), text per language (headline,
  line of text, button label, image description), a wide image for desktops (12:5) and a tall one for phones (4:5)
  uploaded through Medusa's File Module with a focal point, or pasted as URLs; a rough preview of the slide.
- Uploads are rotated by their EXIF orientation and scaled down (desktop ≤ 2400 px wide, phone ≤ 1200 px wide)
  before they are stored; JPEG, PNG, WebP and AVIF by magic bytes, at most 12 MB, SVG refused; replacing or
  removing an image deletes the previous file.
- Placements (`placements` option, default `["home"]`): several independent sets of banners, one list per placement.
- Store API `GET /store/hero-banners?placement=&locale=`: the banners visitors see now, in order, text in the asked
  locale (falls back by language, then to the banner's default), `Cache-Control: public, max-age=60`.
- `revalidate` option: changes are batched and sent as `POST { hero_banners: { placements } }` to the storefront.
- Typed SDK (`medusa-hero-banners/sdk`): `heroBannersStore`, `heroBannersAdmin`.
- Admin texts in English and Indonesian.

[0.1.0]: https://github.com/haustex/cm-medusa-hero-banners/releases/tag/v0.1.0
