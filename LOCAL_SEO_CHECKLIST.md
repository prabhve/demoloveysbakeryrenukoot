# LOVEY'S BAKERY & PIZZA CORNERS — LOCAL SEO & OWNER VERIFICATION CHECKLIST

Use this checklist in the Admin Dashboard (`/admin`) to complete owner-only verification tasks and maximize local visibility in **Renukoot, Hindalco Colony, Pipri, Murdhawa, Turra, Anpara, and Sonbhadra (PIN 231217)**.

---

## 1. Verify Exact Google Maps Pin Coordinates & Opening Hours
1. Sign in to `/admin/login` and navigate to **Settings** (`/admin/settings`).
2. Scroll to **Local SEO Verification: Exact Store Coordinates, Opening Hours & Official Google Review Link**.
3. Open Google Maps at your physical storefront (*In front of Tiwari Hotel, near Punjab National Bank, Renukoot*) and confirm the exact latitude and longitude pin.
4. Enter the verified **Store Latitude** and **Store Longitude**.
5. Check **"I have verified the exact Google Maps pin coordinates"** and **"I have verified daily store opening hours"**.
6. Click **Save All Settings & Narrative**.
   - *Result*: `GeoCoordinates` and `OpeningHoursSpecification` will immediately be emitted in the website's Schema.org `Bakery` JSON-LD.

---

## 2. Verify & Publish Starter Catalogue Products for Google Search
By default, the 10 starter products in `initialCatalogue.ts` are marked `needs_owner_verification` (`noindex: true`) so unverified sample prices or photos are never indexed by Google.
1. Go to **Products** (`/admin/products`).
2. Review each product's name, Hindi name, real selling price (`₹`), size/flavour variants, and photograph.
3. Click **"Verify & Index for SEO"** on each verified product (or open **Edit** and set **Publication & Verification Status** to `Owner Verified & Published`).
   - *Result*: The product page changes from `noindex, nofollow` to `index, follow`, emits `Product` / `ProductGroup` JSON-LD, and is automatically added to `/sitemap.xml` with `<image:image>` tags.

---

## 3. Google Business Profile (GBP) Alignment Checklist
- **Exact Business Name**: `Lovey's Bakery & Pizza Corners`
- **Primary Category**: `Bakery`
- **Secondary Categories**: `Cake Shop`, `Pizza Restaurant`, `Dessert Shop`, `Pizza Takeout`, `Pizza Delivery`
- **Website Link**: `https://demoloveysbakeryrenukoot.vercel.app/`
- **Menu Link**: `https://demoloveysbakeryrenukoot.vercel.app/menu`
- **Order / Custom Cake Link**: `https://demoloveysbakeryrenukoot.vercel.app/custom-cake`
- **Address**: In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217
- **Phone**: `+91 80905 29971`
- **Google Review Link**: Copy your official GBP "Ask for reviews" short URL and paste it into **Verified Google Business Review URL** in `/admin/settings`.
