# AEO, GEO & LLMO OPTIMIZATION GUIDE — LOVEY'S BAKERY & PIZZA CORNERS

This guide documents how Lovey's Bakery & Pizza Corners is structured for **Answer Engine Optimization (AEO)**, **Generative Engine Optimization (GEO)**, and **Large Language Model Optimization (LLMO)** across Google AI Overviews, ChatGPT Search (`OAI-SearchBot`), Perplexity, Claude (`Claude-SearchBot`), and voice assistants.

---

## 1. Clear Entity Definition & Disambiguation
AI answer engines rely on unambiguous entity anchors. Every public page reinforces the core entity facts:
- **Who**: Lovey's Bakery & Pizza Corners (लवी'स बेकरी & पिज्जा कॉर्नर्स)
- **What**: Local bakery, custom celebration cake studio (100% eggless available), and fresh stone-baked pizzeria
- **Where**: In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217, India
- **Service Coverage**: Renukoot Main Market, Hindalco Colony, Pipri, Murdhawa, Turra, and Anpara (PIN 231217)
- **How to Order**: Online website ordering (`/menu` and `/custom-cake`), WhatsApp (`+91 80905 29971`), or direct phone call, confirmed via transparent 20% UPI advance payment verification.

---

## 2. Answer Engine Question & Answer Architecture (AEO)
- Implemented in `/src/utils/seoEngine.ts` (`buildVerifiedAeoQuestions`) and rendered both in server-side pre-rendered HTML and on the Homepage (`Section I0: Common Questions About Custom Cakes, Delivery & UPI Advance`).
- Answers high-intent local voice and AI queries directly and concisely:
  1. *Where is Lovey's Bakery & Pizza Corners located in Renukoot?*
  2. *How can I order a custom birthday or anniversary cake in Renukoot?*
  3. *Does Lovey's Bakery deliver cakes and pizzas to Hindalco Colony and nearby areas?*
  4. *Are 100% eggless cakes available at Lovey's Bakery in Renukoot?*
  5. *How does the UPI advance payment and order confirmation work?*
- Every question-and-answer pair is dynamically synchronized with the owner's live `BusinessSettings` and `PaymentSettings` so visible text and `FAQPage` JSON-LD always match.

---

## 3. Search Bot Permissions (`/robots.txt`)
`/robots.txt` explicitly permits modern search and AI citation crawlers to index public pages while protecting private admin and API routes:
- `Googlebot` & `Googlebot-Image`
- `Bingbot`
- `OAI-SearchBot` & `ChatGPT-User`
- `Claude-SearchBot`
- `PerplexityBot`
- `Applebot`
