# GOOGLE SEARCH CONSOLE & BING WEBMASTER TOOLS SETUP GUIDE

## 1. Property Verification
1. Open [Google Search Console](https://search.google.com/search-console).
2. Add a **URL Prefix** property for `https://demoloveysbakeryrenukoot.vercel.app/` (or your custom production domain when connected).
3. Verify ownership via **HTML Meta Tag** or **DNS TXT record** on your domain provider.

---

## 2. Submit Dynamic XML Sitemap
1. In Google Search Console, go to **Indexing → Sitemaps**.
2. Enter:
   ```text
   sitemap.xml
   ```
3. Click **Submit**.
   - The dynamic `/sitemap.xml` endpoint automatically includes:
     - Core English routes (`/`, `/menu`, `/cakes`, `/custom-cake`, `/gallery`, `/about`, `/contact`)
     - Bilingual Hindi routes (`/hi`, `/hi/menu`, `/hi/cakes`, `/hi/custom-cake`, `/hi/gallery`, `/hi/about`, `/hi/contact`)
     - Active category collection pages (`/categories/birthday-cakes`, `/categories/anniversary-cakes`, `/categories/custom-theme-cakes`, `/categories/pastries-desserts`, `/categories/pizza`, `/categories/burgers-snacks`, `/categories/beverages-addons`)
     - Published local guide and policy pages (`/cake-ordering-guide`, `/delivery-policy`, `/cancellation-policy`, `/privacy-policy`, `/terms`)
     - Owner-verified and published product pages (`/menu/:slug`) with `<image:image>` entries.

---

## 3. Priority URLs for Initial URL Inspection & Indexing
Use the **URL Inspection** bar in Google Search Console to test live URLs and click **Request Indexing** for:
1. `https://demoloveysbakeryrenukoot.vercel.app/`
2. `https://demoloveysbakeryrenukoot.vercel.app/menu`
3. `https://demoloveysbakeryrenukoot.vercel.app/cakes`
4. `https://demoloveysbakeryrenukoot.vercel.app/custom-cake`
5. `https://demoloveysbakeryrenukoot.vercel.app/cake-ordering-guide`
6. `https://demoloveysbakeryrenukoot.vercel.app/categories/birthday-cakes`
7. `https://demoloveysbakeryrenukoot.vercel.app/categories/pizza`
8. `https://demoloveysbakeryrenukoot.vercel.app/contact`
9. `https://demoloveysbakeryrenukoot.vercel.app/hi`

---

## 4. Curl Verification Commands
You can verify the raw server-rendered HTML headers, canonical tags, JSON-LD, and HTTP status codes at any time:
```bash
# 1. Inspect homepage title, canonical, hreflang, and JSON-LD
curl -s https://demoloveysbakeryrenukoot.vercel.app/ | grep -E "<title>|rel=\"canonical\"|hreflang|application/ld\+json"

# 2. Verify genuine HTTP 404 status on invalid routes
curl -I https://demoloveysbakeryrenukoot.vercel.app/non-existent-page-404

# 3. Verify X-Robots-Tag noindex header on cart/checkout/admin
curl -I https://demoloveysbakeryrenukoot.vercel.app/cart

# 4. Inspect dynamic XML sitemap
curl -s https://demoloveysbakeryrenukoot.vercel.app/sitemap.xml
```
