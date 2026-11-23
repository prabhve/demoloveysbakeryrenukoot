# LOVEY'S BAKERY & PIZZA CORNERS — TECHNICAL SEO ARCHITECTURE & IMPLEMENTATION

## 1. Route-Aware SSR & Pre-Rendering Engine

To ensure every public URL returns complete, route-specific metadata and crawlable body HTML in the raw HTTP response without rewriting the entire Firebase + Express + Vite application, we implemented a shared isomorphic SEO and HTML resolution engine:

- **Core Engine**: `/src/utils/seoEngine.ts` (`resolveRouteSeoAndHtml`)
- **Server Integration**: `/server.ts`
  - Syncs live Firestore public catalogue, categories, custom pages, website configuration, and business settings to `.data/public-seo-snapshot.json` via `POST /api/seo/sync-snapshot`.
  - On every public HTTP `GET` request (in both development and production), `server.ts` runs `resolveRouteSeoAndHtml(req.path, origin, snapshot)` and injects:
    - Route-specific `<html lang="en-IN">` or `<html lang="hi-IN">`
    - `<title>` and `<meta name="description">`
    - `<meta name="robots" content="...">`
    - Self-referencing `<link rel="canonical" href="...">`
    - `<link rel="alternate" hreflang="en-IN">`, `hreflang="hi-IN"`, and `hreflang="x-default"`
    - Open Graph (`og:title`, `og:description`, `og:url`, `og:image`, `og:locale`) and Twitter Card tags
    - Schema.org JSON-LD `@graph` inside `<script id="loveys-jsonld" type="application/ld+json">`
    - Pre-rendered semantic HTML (`<main data-ssr-prerender="loveys-seo">...</main>`) inside `<div id="root">` containing the route's `<h1>`, summary copy, verifiable NAP details, AEO Q&A items, and crawlable `<a href="...">` links.
  - When React hydrates on the client in `/src/App.tsx`, it seamlessly replaces the pre-rendered container and keeps `document.title`, canonical, meta tags, and JSON-LD synchronized on client-side navigation.

---

## 2. HTTP Status Codes, Legacy Redirects & Soft-404 Prevention

- **301 Permanent Redirects**:
  - `/categories/pastries` $\rightarrow$ `301` to `/categories/pastries-desserts`
  - `/categories/pizzas` $\rightarrow$ `301` to `/categories/pizza`
- **Genuine HTTP 404 Responses**:
  - Unknown routes, non-existent category slugs (`/categories/invalid-slug`), and missing product slugs (`/menu/missing-item`) return HTTP status `404` with `<meta name="robots" content="noindex, nofollow">` and `X-Robots-Tag: noindex, nofollow`.
- **Transactional & Admin Route Protection**:
  - `/admin`, `/admin/*`, `/cart`, `/checkout`, `/track-order`, `/order/*`, `/orders/*`, and `/payment/*` emit `X-Robots-Tag: noindex, nofollow, noarchive` in HTTP response headers and `<meta name="robots" content="noindex, nofollow, noarchive">` in HTML.

---

## 3. Schema.org Structured Data (`@graph`)

Every indexable page emits a validated JSON-LD `@graph` linking:
1. **`Bakery` / `LocalBusiness` (`#bakery`)**:
   - Includes verified name, alternate Hindi name, postal address (`231217`), telephone (`+91 80905 29971`), `areaServed` (Renukoot, Hindalco Colony, Pipri, Turra, Murdhawa, Anpara, Robertsganj, Sonbhadra), `hasMap`, and `sameAs`.
   - `geo` (`GeoCoordinates`) and `openingHoursSpecification` are conditionally emitted **only** when `coordinatesVerifiedByOwner` / `openingHoursVerifiedByOwner` is enabled in Admin Settings.
2. **`WebSite` (`#website`)** and **`WebPage` / `CollectionPage` (`#webpage`)**
3. **`BreadcrumbList` (`#breadcrumb`)**:
   - Emitted on all secondary routes (`/menu`, `/cakes`, `/categories/:slug`, `/menu/:slug`, etc.).
4. **`Product` / `ProductGroup` (`#product`)**:
   - Emitted on `/menu/:slug` **only** when `isProductOwnerVerifiedAndPublished(product)` is `true`.
   - Multi-size/weight items emit `ProductGroup` (`variesBy: ["https://schema.org/size"]`) with `hasVariant` entries and individual `Offer` nodes in `INR`.
5. **`FAQPage` (`#faq`)**:
   - Emitted on `/`, `/hi`, `/custom-cake`, `/contact`, and `/cake-ordering-guide` using verified operational facts from `buildVerifiedAeoQuestions()`.
