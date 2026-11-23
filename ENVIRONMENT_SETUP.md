# Lovey's Bakery & Pizza Corners — Complete API, Dependency & Environment Variable Audit

**Business**: Lovey's Bakery & Pizza Corners (लवी'स बेकरी & पिज्जा कॉर्नर्स)  
**Location**: In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217, India  
**Architecture**: Full-Stack Web Storefront + 27-Route Enterprise Business Management System (BMS) + Password-Only Admin Authentication + Manual UPI QR Advance Payment & Verification System

---

## 1. Executive Summary of Dependency & API Audit

Lovey's Bakery & Pizza Corners operates with a **minimal, zero-bloat external service footprint**. All routine business operations—catalogue management, multi-dimensional cake variants, bespoke custom cake orders, manual UPI QR advance payments, UTR/screenshot verification, inventory & raw materials ledger, CRM, homepage CMS, gallery, analytics, and password-only staff RBAC—run natively on the application server and database/storage backend without paid third-party gateways.

### Eliminated External Services
- **Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)**: Completely removed. Replaced by the owner-managed **Manual UPI Advance Payment & Verification System** (`/admin/settings/payments` and `/admin/payments`).
- **Hardcoded Owner Password (`ADMIN_OWNER_PASSWORD`)**: Completely removed. Admin and staff authentication uses individual registered accounts with `scrypt` password hashing, session versioning, rate limiting, lockout protection, and single-use recovery links.
- **Google Maps Paid JS SDK (`VITE_GOOGLE_MAPS_API_KEY`, `@vis.gl/react-google-maps`)**: Removed paid API key requirement. Store location and Renukoot landmark directions use standard, key-free Google Maps destination and turn-by-turn direction URLs (`https://www.google.com/maps/dir/?api=1&...`).
- **SMS / OTP / Passkey Providers (`TWILIO_*`, `MSG91_*`, TOTP, WebAuthn)**: Completely removed. Customer communication uses direct Click-to-Call (`tel:+918090529971`), URL-encoded WhatsApp Click-to-Chat (`https://wa.me/918090529971`), and live on-site order tracking (`/track-order`).
- **AI / LLM APIs (`GEMINI_API_KEY`, `@google/genai`)**: Completely removed from the live website.

---

## 2. Complete Environment Variable Classification

### A. Required Variables

| Variable Name | Purpose | Where to Obtain | Visibility / Secret | Where Used | Mandatory? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project endpoint URL for database queries, authentication, and storage buckets (`public-business-media` and `private-payment-evidence`). | Supabase Dashboard &rarr; Project Settings &rarr; Data API | Public (Client & Server) | Database, Auth & Storage client initialization | **Yes** (for Supabase deployments; paired with `firebase-applet-config.json` in AI Studio runtime) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable client key enforcing Row-Level Security (RLS) and storage bucket policies. | Supabase Dashboard &rarr; Project Settings &rarr; API Keys (`publishable` key) | Public (Client & Server) | Client & SSR authenticated requests under RLS | **Yes** |

---

### B. Optional Variables

| Variable Name | Purpose | Where to Obtain | Visibility / Secret | Where Used | Mandatory? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` / `APP_URL` | Canonical public base URL of the deployed website for generating `/robots.txt`, `/sitemap.xml`, and password recovery links. Falls back automatically to the incoming request `Host` header if omitted. | Your deployment domain (e.g. `https://loveysbakery.in`) | Public | `server.ts` (`/robots.txt`, `/sitemap.xml`) | **No** (auto-detected from request origin when omitted) |

---

### C. Conditional Server-Only Variables (Security-Sensitive)

| Variable Name | Purpose | Where to Obtain | Visibility / Secret | Where Used | Mandatory? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_SECRET_KEY` | Privileged server-only key used **exclusively** if executing server-side Supabase Auth administrative operations (such as owner-authorised staff account provisioning). Never used for routine customer, product, order, or inventory queries. | Supabase Dashboard &rarr; Project Settings &rarr; API Keys (`secret` key) | **Server-Only Secret** (Never prefix with `NEXT_PUBLIC_` or `VITE_`; never expose to browser) | Restricted server-side admin handler after verifying signed-in Owner role and `invite_staff` permission | **No** (Conditional — omit unless privileged Auth admin operations are enabled) |

---

### D. Not Needed / Removed Variables (Do Not Configure)

| Removed Variable | Former Purpose | Status & Replacement |
| :--- | :--- | :--- |
| `RAZORPAY_KEY_ID` | Razorpay gateway key ID | **Removed safely.** Replaced by owner-configurable Manual UPI QR & UTR Verification in `/admin/settings/payments`. |
| `RAZORPAY_KEY_SECRET` | Razorpay gateway HMAC secret | **Removed safely.** All payment verification is performed against actual merchant bank/UPI transactions in `/admin/payments`. |
| `ADMIN_OWNER_PASSWORD` | Environment-stored owner password | **Removed safely.** Storing passwords in environment variables is insecure; owner and staff credentials are managed as individual `scrypt`-hashed accounts. |
| `VITE_GOOGLE_MAPS_API_KEY` | Paid Google Maps JS SDK key | **Removed safely.** Replaced by key-free Google Maps destination and landmark route URLs in `StoreMapSection.tsx`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `MSG91_AUTH_KEY` | SMS notifications & SMS OTP | **Removed safely.** Replaced by `tel:` click-to-call, `wa.me` WhatsApp click-to-chat, and website order tracking. |
| `GEMINI_API_KEY` | AI generation / assistant | **Removed safely.** Zero AI dependencies on the live storefront or BMS. |

---

## 3. Package & External SDK Inventory (`package.json`)

| Package / Dependency | Classification | Purpose & Audit Verdict |
| :--- | :--- | :--- |
| `react`, `react-dom` | **A. Required** | Core frontend UI rendering engine. |
| `express` | **A. Required** | Server-side API routes (`/api/orders/verify-pricing`, `/api/payments/validate-submission`, `/api/admin/auth/*`, `/api/admin/payments/signed-evidence-url`, `/robots.txt`, `/sitemap.xml`). |
| `firebase` | **A. Required** | Provisioned real-time database, authentication, and cloud storage SDK in the AI Studio runtime. |
| `lucide-react` | **A. Required** | UI iconography across storefront and 27-route BMS dashboard. |
| `three`, `@types/three`, `motion` | **B. Optional (UI)** | Used for the homepage 3D interactive bakery showcase (`Scroll3DShowcase.tsx`) and smooth micro-interactions. |
| `tailwindcss`, `@tailwindcss/vite`, `vite`, `tsx`, `typescript` | **A. Required (Build)** | Styling, bundling, TypeScript type checking, and server execution. |
| `@vis.gl/react-google-maps` | **D. Unnecessary (Removed)** | Removed so the storefront never requires a paid Google Maps JS API key or triggers quota alerts. |
| `razorpay` | **D. Unnecessary (Never Installed / Removed)** | All Razorpay server endpoints and frontend checkout references removed. |

---

## 4. Storage & Payment Evidence Security Architecture

Media and uploaded files are logically separated into two security tiers:

### Tier 1: Public Business Media (`public-business-media`)
- **Contents**: Product photographs, celebration cake photographs, homepage hero banners, public gallery photos/videos, and the customer-facing **Owner UPI QR Code image** (`payment_qr/*`).
- **Access Policy**:
  - **Public Read**: Customers can view product photos, gallery media, and the active UPI QR code on the payment screen (`/order/:orderNumber` and `/payment/:orderNumber`).
  - **Restricted Write**: Only authenticated Owner / Content Manager / Store Manager accounts can upload or replace the UPI QR code (`/admin/settings/payments`) or catalogue images.

### Tier 2: Private Business Records (`private-payment-evidence`)
- **Contents**: Customer UPI payment screenshots (`payment_submissions/*`) and sensitive order verification attachments.
- **Access Policy**:
  - **No Public Listing**: Public `list` queries on `payment_submissions` and `order_payments` are strictly denied by database security rules (`allow list: if isAdmin();`). Customers cannot list or browse other customers' payment screenshots.
  - **Strict File Validation**: Server endpoint `/api/payments/validate-submission` enforces allowed MIME types (`image/jpeg`, `image/png`, `image/webp`), maximum file size (`<= 5 MB`), binary magic-byte header verification (`FFD8FF` for JPEG, `89504E47` for PNG, `RIFF...WEBP` for WebP), and 6–36 character alphanumeric UTR validation.
  - **Short-Lived Signed Evidence Access**: Authorised staff inspecting payment evidence in `/admin/payments` request a role-verified, time-limited (5-minute) HMAC-signed evidence token via `/api/admin/payments/signed-evidence-url`.
