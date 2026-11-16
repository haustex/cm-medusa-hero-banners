# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | yes |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately:

- through GitHub: **Security → Report a vulnerability** on
  [haustex/cm-medusa-hero-banners](https://github.com/haustex/cm-medusa-hero-banners/security), or
- by e-mail to [dev@hauskayu.com](mailto:dev@hauskayu.com), subject "Security: medusa-hero-banners".

Include the plugin and Medusa versions, what an attacker can do, and steps to reproduce. We will confirm that we
received the report, keep you updated while we fix it, and credit you in the release notes if you wish.

## Scope

Of particular interest:

- storing a `javascript:`, `data:` or protocol-relative (`//host`) link or image address through the Admin API;
- getting a non-image file (SVG, HTML) stored and served as a banner image through the upload route;
- reading or changing banners without an Admin login, or reading banners that are off, scheduled or expired through
  the Store API;
- making the upload route consume unbounded memory or CPU (the limits are 12 MB and 80 megapixels).

## Operating the plugin safely

- Set `storefront.url` to your real origin; the Admin builds its "leads to" links from it.
- Serve uploads from a host your storefront's image optimizer allows, and nothing else.
