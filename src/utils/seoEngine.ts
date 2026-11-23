import {
  BusinessSettings,
  CategoryItem,
  ProductItem,
  CakeDesignItem,
  CustomPageRecord,
  WebsiteConfigRecord,
  DeliveryZoneItem,
  PaymentSettings,
  parseVariantOptions,
} from '../data/initialCatalogue';

export const DEFAULT_PUBLIC_ORIGIN = 'https://demoloveysbakeryrenukoot.vercel.app';

export function normalizePublicOrigin(rawOrigin?: string): string {
  const cleaned = (rawOrigin || DEFAULT_PUBLIC_ORIGIN).trim().replace(/\/+$/, '');
  return cleaned.startsWith('http') ? cleaned : DEFAULT_PUBLIC_ORIGIN;
}

export function isProductOwnerVerifiedAndPublished(p: ProductItem): boolean {
  if (!p) return false;
  if (p.isArchived || p.noindex) return false;
  if (p.publicationStatus) {
    return p.publicationStatus === 'published' || p.publicationStatus === 'approved';
  }
  if (p.provenance === 'sample_seed') {
    return Boolean(p.ownerVerifiedAt && p.isPublished);
  }
  return Boolean(p.isPublished && p.isAvailable);
}

export function isCakeDesignOwnerVerifiedAndPublished(d: CakeDesignItem): boolean {
  if (!d) return false;
  if (!d.isActive || d.noindex) return false;
  if (d.publicationStatus) {
    return d.publicationStatus === 'published' || d.publicationStatus === 'approved';
  }
  if (d.provenance === 'sample_seed') {
    return Boolean(d.ownerVerifiedAt);
  }
  return Boolean(d.isActive);
}

export interface RouteSeoSnapshotData {
  settings: BusinessSettings;
  websiteConfig: WebsiteConfigRecord;
  paymentSettings: PaymentSettings;
  categories: CategoryItem[];
  products: ProductItem[];
  cakeDesigns: CakeDesignItem[];
  customPages: CustomPageRecord[];
  deliveryZones: DeliveryZoneItem[];
}

export interface ResolvedRouteSeoResult {
  httpStatus: 200 | 404;
  lang: 'en' | 'hi';
  htmlLang: 'en-IN' | 'hi-IN';
  normalizedPath: string;
  basePath: string;
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'product' | 'article';
  ogImage: string;
  hreflangEnUrl?: string;
  hreflangHiUrl?: string;
  hreflangDefaultUrl?: string;
  jsonLdGraph: Record<string, any>;
  ssrBodyHtml: string;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAbsoluteUrl(origin: string, pathOrUrl: string): string {
  const cleanOrigin = normalizePublicOrigin(origin);
  if (!pathOrUrl) return `${cleanOrigin}/`;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${cleanOrigin}${cleanPath}`;
}

const BILINGUAL_CORE_PATHS = new Set([
  '/',
  '/menu',
  '/cakes',
  '/custom-cake',
  '/gallery',
  '/about',
  '/contact',
]);

export function resolveCategoryAliasSlug(rawSlug: string): string {
  const clean = rawSlug.trim().toLowerCase();
  if (clean === 'pastries') return 'pastries-desserts';
  if (clean === 'pizzas') return 'pizza';
  return clean;
}

export interface AeoQuestionItem {
  id: string;
  question: string;
  questionHi: string;
  answer: string;
  answerHi: string;
  linkText: string;
  linkHref: string;
}

export function buildVerifiedAeoQuestions(data: RouteSeoSnapshotData): AeoQuestionItem[] {
  const { settings, paymentSettings, deliveryZones } = data;
  const serviceableLocalities = deliveryZones
    .filter((z) => z.isServiceable)
    .map((z) => `${z.localityName} (PIN ${z.pinCode})`)
    .join(', ');

  return [
    {
      id: 'aeo-location',
      question: "Where is Lovey's Bakery & Pizza Corners located in Renukoot?",
      questionHi: "रेणुकूट में लवी'स बेकरी & पिज्जा कॉर्नर्स कहाँ स्थित है?",
      answer: `${settings.businessName} (${settings.hindiName}) is located at ${settings.address}. You can reach our counter directly at ${settings.phone} or get turn-by-turn directions on our Contact page.`,
      answerHi: `${settings.hindiName} का पता ${settings.address} है। आप सीधे ${settings.phone} पर संपर्क कर सकते हैं।`,
      linkText: 'View Store Location & Directions',
      linkHref: '/contact',
    },
    {
      id: 'aeo-custom-cake',
      question: 'How can I order a custom birthday or celebration cake in Renukoot?',
      questionHi: 'मैं रेणुकूट में कस्टम बर्थडे या सेलिब्रेशन केक कैसे ऑर्डर कर सकता हूँ?',
      answer:
        'Visit our Custom Cake Studio (/custom-cake) to choose your occasion, weight (0.5 kg to 5.0 kg+), sponge flavour, filling, frosting, and personalised message on the cake. You can also upload a reference cake photograph (JPG, PNG, or WebP up to 5 MB).',
      answerHi:
        'हमारे कस्टम केक स्टूडियो (/custom-cake) पर जाकर केक का वजन, फ्लेवर, फ्रॉस्टिंग और केक पर लिखने के लिए संदेश चुनें तथा रेफरेंस फोटो अपलोड करें।',
      linkText: 'Open Custom Cake Studio',
      linkHref: '/custom-cake',
    },
    {
      id: 'aeo-cake-sizes-lead-time',
      question: 'What cake sizes are available and how much advance notice is required?',
      questionHi: 'केक के कौन-से साइज़ उपलब्ध हैं और कितने समय पहले बुकिंग करनी चाहिए?',
      answer:
        'Cakes can be configured from 500g (0.5 kg) and 1 kg up to multi-tier 3 kg and 5 kg celebration centerpieces. Standard celebration cakes require 4 to 6 hours advance notice, while two-tier and custom theme cakes should be ordered 12 to 24 hours in advance.',
      answerHi:
        '500 ग्राम और 1 किलो से लेकर मल्टी-टियर 3-5 किलो तक के केक उपलब्ध हैं। सामान्य केक के लिए 4-6 घंटे और कस्टम थीम केक के लिए 12-24 घंटे पहले ऑर्डर करना उचित है।',
      linkText: 'Read Cake Weight & Ordering Guide',
      linkHref: '/cake-ordering-guide',
    },
    {
      id: 'aeo-delivery-takeaway-dinein',
      question: "Does Lovey's provide home delivery, takeaway parcels, and dine-in in Renukoot?",
      questionHi: 'क्या रेणुकूट में होम डिलीवरी, टेकअवे पार्सल और डाइन-इन की सुविधा उपलब्ध है?',
      answer: `Yes. We support Home Delivery (${settings.deliveryEnabled ? 'Active' : 'Currently Paused'}), Takeaway / Parcel Pickup (${settings.pickupEnabled ? 'Active' : 'Currently Paused'}), and Dine-In table service (${settings.dineInEnabled ? 'Active' : 'Currently Paused'}). Confirmed serviceable delivery areas include: ${serviceableLocalities || 'Renukoot Main Market (PIN 231217)'}.`,
      answerHi: `हाँ, हमारे यहाँ होम डिलीवरी, टेकअवे पार्सल और डाइन-इन सेवा उपलब्ध है। डिलीवरी क्षेत्र: ${serviceableLocalities || 'रेणुकूट मेन मार्केट (231217)'}।`,
      linkText: 'View Delivery & PIN Code Policy',
      linkHref: '/delivery-policy',
    },
    {
      id: 'aeo-upi-advance-verification',
      question: 'How does manual UPI advance payment and order confirmation work?',
      questionHi: 'UPI एडवांस पेमेंट और ऑर्डर कन्फर्मेशन की प्रक्रिया क्या है?',
      answer: `For eligible Home Delivery and Takeaway Parcel orders, our checkout calculates the required advance payment (${paymentSettings.advanceType === 'fixed' ? `₹${paymentSettings.fixedAdvanceAmount}` : `${paymentSettings.advancePercentage}%`}, minimum ₹${paymentSettings.minAdvanceAmount}). Pay using our official UPI ID (${paymentSettings.upiId}) or QR code, then submit your 12-digit UTR and screenshot for manual verification by our Renukoot counter.`,
      answerHi: `होम डिलीवरी और टेकअवे ऑर्डर के लिए निर्धारित एडवांस राशि हमारे आधिकारिक UPI ID (${paymentSettings.upiId}) या QR कोड पर भुगतान करें और 12-अंकों का UTR व स्क्रीनशॉट अपलोड करें।`,
      linkText: 'Track Order & Payment Verification',
      linkHref: '/track-order',
    },
    {
      id: 'aeo-quotation',
      question: 'How can I request a custom cake price quotation or contact the bakery?',
      questionHi: 'मैं कस्टम केक का कोटेशन कैसे प्राप्त करूँ या बेकरी से कैसे संपर्क करूँ?',
      answer: `In the Custom Cake Studio, enable the "Request Bespoke Chef Quotation" toggle when submitting a multi-tier or reference photo cake, or contact our Renukoot desk directly at ${settings.phone} via phone call or WhatsApp.`,
      answerHi: `कस्टम केक स्टूडियो में "Request Bespoke Chef Quotation" चुनें या सीधे ${settings.phone} पर कॉल या व्हाट्सऐप करें।`,
      linkText: 'Contact Bakery Desk',
      linkHref: '/contact',
    },
  ];
}

export function resolveRouteSeoAndHtml(
  rawUrlPath: string,
  originInput: string,
  data: RouteSeoSnapshotData
): ResolvedRouteSeoResult {
  const origin = normalizePublicOrigin(originInput);
  const {
    settings,
    websiteConfig,
    categories,
    products,
    cakeDesigns,
    customPages,
    deliveryZones,
  } = data;

  const cleanUrlPath = (rawUrlPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const isHindiRoute = cleanUrlPath === '/hi' || cleanUrlPath.startsWith('/hi/');
  const lang: 'en' | 'hi' = isHindiRoute ? 'hi' : 'en';
  const htmlLang: 'en-IN' | 'hi-IN' = isHindiRoute ? 'hi-IN' : 'en-IN';

  const basePath = isHindiRoute
    ? cleanUrlPath.replace(/^\/hi/, '') || '/'
    : cleanUrlPath;

  const businessId = `${origin}/#bakery`;
  const orgId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;

  const defaultHeroImg = buildAbsoluteUrl(
    origin,
    websiteConfig.ogImageUrl || settings.heroBannerUrl || '/assets/hero/loveys-hero-spread.jpg'
  );

  // Build Base LocalBusiness / Bakery & Organization Graph (Phases 4 & 6)
  // Respect location & opening hours verification policy: only emit GeoCoordinates or OpeningHoursSpecification if verified by owner
  const localBusinessNode: Record<string, any> = {
    '@type': ['Bakery', 'FoodEstablishment', 'LocalBusiness'],
    '@id': businessId,
    name: settings.businessName || "Lovey's Bakery & Pizza Corners",
    alternateName: settings.hindiName || "लवी'स बेकरी & पिज्जा कॉर्नर्स",
    description:
      websiteConfig.seoDefaultDescription ||
      "Artisan bakery, custom celebration cake studio, and pizza corner in front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh.",
    url: `${origin}/`,
    telephone: settings.phone || '+91 80905 29971',
    image: [
      buildAbsoluteUrl(origin, '/assets/hero/loveys-hero-spread.jpg'),
      buildAbsoluteUrl(origin, '/assets/cakes/loveys-tier-celebration-cake.jpg'),
      buildAbsoluteUrl(origin, '/assets/cakes/loveys-chocolate-truffle-gateau.jpg'),
      buildAbsoluteUrl(origin, '/assets/pizza/loveys-stone-baked-pizza.jpg'),
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'In front of Tiwari Hotel, near Punjab National Bank',
      addressLocality: 'Renukoot',
      addressRegion: 'Uttar Pradesh',
      postalCode: '231217',
      addressCountry: 'IN',
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Renukoot',
      },
      {
        '@type': 'AdministrativeArea',
        name: 'Sonbhadra',
      },
    ],
    hasMap:
      settings.googleMapsUrl ||
      "https://www.google.com/maps/place/Lovey's+Bakery+%26+Pizza+Corners/",
    menu: `${origin}/menu`,
    servesCuisine: ['Bakery', 'Custom Cakes', 'Pizza', 'Pastries', 'Fast Food'],
    sameAs: [
      settings.facebookUrl || 'https://www.facebook.com/loveysbakeryandpizzacorner/',
      settings.googleMapsUrl ||
        "https://www.google.com/maps/place/Lovey's+Bakery+%26+Pizza+Corners/",
    ],
  };

  if (
    settings.coordinatesVerifiedByOwner &&
    typeof settings.coordinatesLat === 'number' &&
    typeof settings.coordinatesLng === 'number'
  ) {
    localBusinessNode.geo = {
      '@type': 'GeoCoordinates',
      latitude: settings.coordinatesLat,
      longitude: settings.coordinatesLng,
    };
  }

  if (settings.openingHoursVerifiedByOwner && settings.openingHours) {
    localBusinessNode.openingHours = settings.openingHours;
  }

  const organizationNode: Record<string, any> = {
    '@type': 'Organization',
    '@id': orgId,
    name: settings.businessName || "Lovey's Bakery & Pizza Corners",
    alternateName: settings.hindiName || "लवी'स बेकरी & पिज्जा कॉर्नर्स",
    url: `${origin}/`,
    telephone: settings.phone || '+91 80905 29971',
    sameAs: localBusinessNode.sameAs,
  };

  const websiteNode: Record<string, any> = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: `${origin}/`,
    name: settings.businessName || "Lovey's Bakery & Pizza Corners",
    alternateName: settings.hindiName || "लवी'स बेकरी & पिज्जा कॉर्नर्स",
    publisher: { '@id': orgId },
    inLanguage: ['en-IN', 'hi-IN'],
  };

  const verifiedProducts = products.filter(isProductOwnerVerifiedAndPublished);
  const verifiedDesigns = cakeDesigns.filter(isCakeDesignOwnerVerifiedAndPublished);
  const activeCategories = categories.filter((c) => c.isActive && !c.noindex);
  const aeoQuestions = buildVerifiedAeoQuestions(data);

  // Bilingual Hreflang helper
  let hreflangEnUrl: string | undefined;
  let hreflangHiUrl: string | undefined;
  let hreflangDefaultUrl: string | undefined;
  if (BILINGUAL_CORE_PATHS.has(basePath)) {
    hreflangEnUrl = `${origin}${basePath === '/' ? '/' : basePath}`;
    hreflangHiUrl = `${origin}${basePath === '/' ? '/hi' : `/hi${basePath}`}`;
    hreflangDefaultUrl = hreflangEnUrl;
  }

  // 1. PRIVATE / TRANSACTIONAL / ADMIN ROUTES (Phase 12: strict noindex, nofollow, noarchive)
  if (
    basePath.startsWith('/admin') ||
    basePath === '/cart' ||
    basePath === '/checkout' ||
    basePath === '/track-order' ||
    basePath.startsWith('/order/') ||
    basePath.startsWith('/orders/') ||
    basePath.startsWith('/payment/')
  ) {
    const title = basePath.startsWith('/admin')
      ? `Admin Management Console | ${settings.businessName}`
      : `Order & Checkout Desk | ${settings.businessName}`;
    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description: `Transactional customer order, checkout, and management area for ${settings.businessName}, Renukoot.`,
      canonicalUrl: `${origin}${basePath}`,
      robots: 'noindex, nofollow, noarchive',
      ogType: 'website',
      ogImage: defaultHeroImg,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [websiteNode],
      },
      ssrBodyHtml: `<main class="max-w-5xl mx-auto px-4 py-12"><h1>${escapeHtml(title)}</h1><p>Secure transactional route for ${escapeHtml(settings.businessName)}, Renukoot.</p></main>`,
    };
  }

  // 2. HOMEPAGE (/ or /hi)
  if (basePath === '/') {
    const title =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स | रेणुकूट में बेकरी, कस्टम केक और पिज़्ज़ा"
        : "Lovey's Bakery & Pizza Corners | Bakery & Custom Cakes in Renukoot";
    const description =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स (तिवारी होटल के सामने, पंजाब नेशनल बैंक के पास, रेणुकूट, सोनभद्र) से कस्टम बर्थडे केक, चॉकलेट केक, पिज़्ज़ा और बेकरी स्नैक्स ऑर्डर करें।"
        : "Order custom birthday & celebration cakes, chocolate truffle cakes, freshly baked pizzas, pastries, and takeaway snacks from Lovey's Bakery & Pizza Corners, in front of Tiwari Hotel near Punjab National Bank, Renukoot, Sonbhadra.";
    const canonicalUrl = lang === 'hi' ? `${origin}/hi` : `${origin}/`;

    const webPageNode = {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    const ssrBodyHtml = `
      <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-10">
        <header class="space-y-4">
          <p class="text-xs font-bold uppercase tracking-widest text-[#B94E62]">${escapeHtml(settings.businessName)} · ${escapeHtml(settings.hindiName)}</p>
          <h1 class="text-3xl sm:text-5xl font-serif font-bold text-[#3B2824]">${escapeHtml(
            lang === 'hi'
              ? websiteConfig.heroHeadingHi || 'रेणुकूट में ताज़ा बेक किए गए सेलिब्रेशन केक और स्टोन-बेक्ड पिज़्ज़ा'
              : websiteConfig.heroHeading || 'Artisan Celebration Cakes & Stone-Baked Pizzas in Renukoot'
          )}</h1>
          <p class="text-base text-[#6B544E] max-w-3xl">${escapeHtml(description)}</p>
          <nav aria-label="Primary Storefront Links" class="flex flex-wrap gap-3 pt-2">
            <a href="/menu" class="underline font-semibold">Explore Menu</a>
            <a href="/cakes" class="underline font-semibold">Celebration Cakes</a>
            <a href="/custom-cake" class="underline font-semibold">Custom Cake Studio</a>
            <a href="/gallery" class="underline font-semibold">Bakery Gallery</a>
            <a href="/about" class="underline font-semibold">Our Story</a>
            <a href="/contact" class="underline font-semibold">Location &amp; Contact</a>
            <a href="/cake-ordering-guide" class="underline font-semibold">Cake Ordering Guide</a>
          </nav>
        </header>
        <section aria-labelledby="ssr-categories-heading" class="space-y-4">
          <h2 id="ssr-categories-heading" class="text-2xl font-serif font-bold">Bakery, Cake &amp; Pizza Categories in Renukoot</h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            ${activeCategories
              .map(
                (cat) => `<li>
                  <a href="/categories/${escapeHtml(cat.slug)}" class="block p-4 border rounded-xl">
                    <strong>${escapeHtml(lang === 'hi' ? cat.hindiName || cat.name : cat.name)}</strong>
                    <p class="text-sm text-[#6B544E]">${escapeHtml(lang === 'hi' ? cat.descriptionHi || cat.description : cat.description)}</p>
                  </a>
                </li>`
              )
              .join('')}
          </ul>
        </section>
        <section aria-labelledby="ssr-local-entity-heading" class="space-y-3 border-t pt-6">
          <h2 id="ssr-local-entity-heading" class="text-2xl font-serif font-bold">Visit Our Bakery in Renukoot, Sonbhadra</h2>
          <p><strong>Official Business Name:</strong> ${escapeHtml(settings.businessName)} (${escapeHtml(settings.hindiName)})</p>
          <p><strong>Address:</strong> ${escapeHtml(settings.address)}</p>
          <p><strong>Phone &amp; WhatsApp Ordering Desk:</strong> <a href="tel:+918090529971">${escapeHtml(settings.phone)}</a></p>
          <p><strong>Fulfilment Options:</strong> Home Delivery in serviceable Renukoot localities, Express Takeaway Parcel Pickup, and Dine-In Table Service.</p>
        </section>
        <section aria-labelledby="ssr-aeo-heading" class="space-y-4 border-t pt-6">
          <h2 id="ssr-aeo-heading" class="text-2xl font-serif font-bold">Frequently Asked Customer Questions in Renukoot</h2>
          <div class="space-y-4">
            ${aeoQuestions
              .map(
                (q) => `<article class="p-4 border rounded-xl">
                  <h3 class="font-bold text-lg">${escapeHtml(lang === 'hi' ? q.questionHi : q.question)}</h3>
                  <p class="text-sm mt-1">${escapeHtml(lang === 'hi' ? q.answerHi : q.answer)}</p>
                  <p class="text-xs mt-2"><a href="${escapeHtml(q.linkHref)}" class="underline font-semibold">${escapeHtml(q.linkText)}</a></p>
                </article>`
              )
              .join('')}
          </div>
        </section>
      </main>
    `;

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogImage: defaultHeroImg,
      hreflangEnUrl,
      hreflangHiUrl,
      hreflangDefaultUrl,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, organizationNode, websiteNode, webPageNode],
      },
      ssrBodyHtml,
    };
  }

  // 3. MENU PAGE (/menu or /hi/menu)
  if (basePath === '/menu') {
    const title =
      lang === 'hi'
        ? "बेकरी, पिज़्ज़ा और फ़ूड मेनू — रेणुकूट | लवी'स बेकरी"
        : "Bakery, Pizza & Food Menu in Renukoot | Lovey's";
    const description =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स, रेणुकूट का पूरा बेकरी, केक, पिज़्ज़ा, बर्गर, वाफल्स और स्नैक्स मेनू देखें।"
        : "Browse the bakery, celebration cake, pizza, burger, Belgian waffle, pastry, and evening snack menu at Lovey's Bakery & Pizza Corners in Renukoot, Sonbhadra.";
    const canonicalUrl = lang === 'hi' ? `${origin}/hi/menu` : `${origin}/menu`;

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Menu', item: canonicalUrl },
      ],
    };

    const collectionNode = {
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    const ssrBodyHtml = `
      <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Explore Menu</span></nav>
        <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <section class="space-y-4">
          <h2 class="text-2xl font-serif font-bold">Browse by Bakery &amp; Café Category</h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            ${activeCategories
              .map(
                (c) => `<li>
                  <a href="/categories/${escapeHtml(c.slug)}" class="block p-4 border rounded-xl">
                    <strong>${escapeHtml(c.name)}</strong> (${escapeHtml(c.hindiName || '')})
                    <p class="text-sm">${escapeHtml(c.description)}</p>
                  </a>
                </li>`
              )
              .join('')}
          </ul>
        </section>
        ${
          verifiedProducts.length > 0
            ? `<section class="space-y-4">
                <h2 class="text-2xl font-serif font-bold">Owner-Verified Menu Items</h2>
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  ${verifiedProducts
                    .map(
                      (p) => `<li>
                        <a href="/menu/${escapeHtml(p.slug)}" class="block p-4 border rounded-xl">
                          <strong>${escapeHtml(p.name)}</strong> — ₹${Number(p.price ?? p.basePrice ?? 0)}
                          <p class="text-sm">${escapeHtml(p.description || '')}</p>
                        </a>
                      </li>`
                    )
                    .join('')}
                </ul>
              </section>`
            : `<section class="p-4 border rounded-xl">
                <h2 class="text-xl font-bold">Order Custom Cakes, Pizzas &amp; Bakery Items</h2>
                <p>Explore our categories above, design a bespoke cake in our <a href="/custom-cake" class="underline">Custom Cake Studio</a>, or contact our Renukoot counter at ${escapeHtml(settings.phone)}.</p>
              </section>`
        }
      </main>
    `;

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogImage: defaultHeroImg,
      hreflangEnUrl,
      hreflangHiUrl,
      hreflangDefaultUrl,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, collectionNode, breadcrumbNode],
      },
      ssrBodyHtml,
    };
  }

  // 4. CAKE CATALOGUE (/cakes or /hi/cakes)
  if (basePath === '/cakes') {
    const title =
      lang === 'hi'
        ? "रेणुकूट में बर्थडे, चॉकलेट और डिज़ाइनर केक | लवी'स बेकरी"
        : "Birthday, Chocolate & Designer Cakes in Renukoot | Lovey's";
    const description =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स, रेणुकूट से ताज़ा बर्थडे केक, चॉकलेट ट्रफल केक, एनिवर्सरी केक और डिज़ाइनर केक ऑर्डर करें।"
        : "Explore birthday cakes, chocolate truffle gateaux, anniversary cakes, and designer celebration cakes at Lovey's Bakery & Pizza Corners in Renukoot, Sonbhadra.";
    const canonicalUrl = lang === 'hi' ? `${origin}/hi/cakes` : `${origin}/cakes`;

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Cakes', item: canonicalUrl },
      ],
    };

    const collectionNode = {
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    const cakeCategories = activeCategories.filter((c) => c.slug.includes('cake'));

    const ssrBodyHtml = `
      <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Celebration Cakes</span></nav>
        <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <section class="space-y-4">
          <h2 class="text-2xl font-serif font-bold">Celebration Cake Categories in Renukoot</h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            ${cakeCategories
              .map(
                (c) => `<li>
                  <a href="/categories/${escapeHtml(c.slug)}" class="block p-4 border rounded-xl">
                    <strong>${escapeHtml(c.name)}</strong>
                    <p class="text-sm">${escapeHtml(c.description)}</p>
                  </a>
                </li>`
              )
              .join('')}
          </ul>
        </section>
        <p><a href="/custom-cake" class="underline font-bold">Design a Custom Celebration Cake in our Custom Cake Studio &rarr;</a></p>
      </main>
    `;

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogImage: buildAbsoluteUrl(origin, '/assets/cakes/loveys-tier-celebration-cake.jpg'),
      hreflangEnUrl,
      hreflangHiUrl,
      hreflangDefaultUrl,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, collectionNode, breadcrumbNode],
      },
      ssrBodyHtml,
    };
  }

  // 5. CUSTOM CAKE STUDIO (/custom-cake or /hi/custom-cake)
  if (basePath === '/custom-cake') {
    const title =
      lang === 'hi'
        ? "रेणुकूट में कस्टम बर्थडे और सेलिब्रेशन केक ऑर्डर करें | लवी'स"
        : "Custom Birthday & Celebration Cakes in Renukoot | Lovey's";
    const description =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स, रेणुकूट में अपनी पसंद का केक वजन (0.5 kg से 5 kg), फ्लेवर, फ्रॉस्टिंग, नाम और रेफरेंस फोटो चुनकर कस्टम केक बनवाएं।"
        : "Order custom birthday, anniversary, and multi-tier celebration cakes in Renukoot. Configure weight (0.5 kg to 5 kg), flavour, filling, frosting, message on cake, and upload a reference photo at Lovey's Bakery & Pizza Corners.";
    const canonicalUrl = lang === 'hi' ? `${origin}/hi/custom-cake` : `${origin}/custom-cake`;

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Custom Cake Studio', item: canonicalUrl },
      ],
    };

    const webPageNode = {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    const ssrBodyHtml = `
      <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Custom Cake Studio</span></nav>
        <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <section class="space-y-3">
          <h2 class="text-2xl font-serif font-bold">How Custom Cake Ordering Works at Lovey's Renukoot</h2>
          <ol class="list-decimal pl-5 space-y-2">
            <li>Choose your celebration occasion (Birthday, Anniversary, Engagement, Kids Theme, or Corporate Event).</li>
            <li>Select cake weight (0.5 kg, 1.0 kg, 1.5 kg, 2.0 kg, 3.0 kg, or 5.0 kg) and tier structure.</li>
            <li>Configure sponge flavour, filling, frosting finish, and dietary preference.</li>
            <li>Enter your custom cake inscription and upload an optional reference photograph (JPG/PNG/WebP up to 5 MB).</li>
            <li>Choose Home Delivery in serviceable Renukoot PIN zones or Takeaway Pickup at our counter in front of Tiwari Hotel, near Punjab National Bank.</li>
          </ol>
        </section>
        <p><a href="/cake-ordering-guide" class="underline font-semibold">Read our complete Custom Cake Weight &amp; Advance Booking Guide &rarr;</a></p>
      </main>
    `;

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogImage: buildAbsoluteUrl(origin, '/assets/cakes/loveys-tier-celebration-cake.jpg'),
      hreflangEnUrl,
      hreflangHiUrl,
      hreflangDefaultUrl,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, webPageNode, breadcrumbNode],
      },
      ssrBodyHtml,
    };
  }

  // 6. GALLERY PAGE (/gallery or /hi/gallery)
  if (basePath === '/gallery') {
    const title =
      lang === 'hi'
        ? "केक, बेकरी और पिज़्ज़ा फोटो गैलरी — रेणुकूट | लवी'स बेकरी"
        : "Cake, Bakery & Pizza Photo Gallery in Renukoot | Lovey's";
    const description =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स, रेणुकूट के सेलिब्रेशन केक, चॉकलेट ट्रफल, पिज़्ज़ा और बेकरी आइटम्स की गैलरी देखें।"
        : "View photographs of celebration cakes, chocolate truffle gateaux, stone-baked pizzas, and pastries at Lovey's Bakery & Pizza Corners in Renukoot, Sonbhadra.";
    const canonicalUrl = lang === 'hi' ? `${origin}/hi/gallery` : `${origin}/gallery`;

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Gallery', item: canonicalUrl },
      ],
    };

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogImage: defaultHeroImg,
      hreflangEnUrl,
      hreflangHiUrl,
      hreflangDefaultUrl,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, breadcrumbNode],
      },
      ssrBodyHtml: `
        <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-6">
          <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Gallery</span></nav>
          <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </main>
      `,
    };
  }

  // 7. CONTACT PAGE (/contact or /hi/contact)
  if (basePath === '/contact') {
    const title =
      lang === 'hi'
        ? "लवी'स बेकरी लोकेशन और संपर्क | रेणुकूट, सोनभद्र"
        : "Lovey's Bakery Location & Contact | Renukoot, Sonbhadra";
    const description =
      lang === 'hi'
        ? "लवी'स बेकरी & पिज्जा कॉर्नर्स, तिवारी होटल के सामने, पंजाब नेशनल बैंक के पास, रेणुकूट, सोनभद्र (UP 231217)। फ़ोन और व्हाट्सऐप: +91 80905 29971।"
        : "Visit Lovey's Bakery & Pizza Corners in front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217. Call or WhatsApp +91 80905 29971 for cake and food orders.";
    const canonicalUrl = lang === 'hi' ? `${origin}/hi/contact` : `${origin}/contact`;

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Contact & Store Location', item: canonicalUrl },
      ],
    };

    const contactPageNode = {
      '@type': 'ContactPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: 'index, follow',
      ogType: 'website',
      ogImage: buildAbsoluteUrl(origin, '/assets/store/loveys-bakery-table.jpg'),
      hreflangEnUrl,
      hreflangHiUrl,
      hreflangDefaultUrl,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, contactPageNode, breadcrumbNode],
      },
      ssrBodyHtml: `
        <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-6">
          <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Location &amp; Contact</span></nav>
          <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
          <section class="space-y-2">
            <h2 class="text-xl font-bold">Store Address &amp; Landmarks</h2>
            <p><strong>Business Name:</strong> ${escapeHtml(settings.businessName)} (${escapeHtml(settings.hindiName)})</p>
            <p><strong>Address:</strong> ${escapeHtml(settings.address)}</p>
            <p><strong>Primary Landmarks:</strong> Opposite Tiwari Hotel, Near Punjab National Bank (PNB), Main Market Road, Renukoot, Sonbhadra, Uttar Pradesh 231217</p>
            <p><strong>Phone &amp; WhatsApp:</strong> <a href="tel:+918090529971">${escapeHtml(settings.phone)}</a></p>
            <p><strong>Google Maps Destination:</strong> <a href="${escapeHtml(settings.googleMapsUrl || "https://www.google.com/maps/place/Lovey's+Bakery+%26+Pizza+Corners/")}">Open in Google Maps</a></p>
          </section>
        </main>
      `,
    };
  }

  // 8. CATEGORY PAGES (/categories/:slug)
  if (basePath.startsWith('/categories/')) {
    const rawSlug = basePath.replace('/categories/', '').trim();
    const resolvedSlug = resolveCategoryAliasSlug(rawSlug);
    const category = categories.find((c) => c.slug === resolvedSlug && c.isActive);

    if (!category) {
      return {
        httpStatus: 404,
        lang,
        htmlLang,
        normalizedPath: cleanUrlPath,
        basePath,
        title: `Category Not Found (404) | ${settings.businessName}`,
        description: `The requested bakery category could not be found at ${settings.businessName}, Renukoot.`,
        canonicalUrl: `${origin}${basePath}`,
        robots: 'noindex, nofollow',
        ogType: 'website',
        ogImage: defaultHeroImg,
        jsonLdGraph: { '@context': 'https://schema.org', '@graph': [websiteNode] },
        ssrBodyHtml: `<main class="max-w-4xl mx-auto px-4 py-16"><h1>404 — Category Not Found</h1><p>We could not find that category. <a href="/menu" class="underline">Return to the Lovey's Bakery Menu</a>.</p></main>`,
      };
    }

    const canonicalUrl =
      category.canonicalUrl || `${origin}/categories/${category.slug}`;
    const title =
      category.seoTitle ||
      `${category.name} in Renukoot | Lovey's Bakery & Pizza Corners`;
    const description =
      category.seoDescription ||
      `${category.description} Order ${category.name.toLowerCase()} for takeaway, dine-in, or home delivery in Renukoot from Lovey's Bakery & Pizza Corners.`;

    const categoryVerifiedProducts = verifiedProducts.filter(
      (p) => p.categoryId === category.id || p.categorySlug === category.slug
    );

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Menu', item: `${origin}/menu` },
        { '@type': 'ListItem', position: 3, name: category.name, item: canonicalUrl },
      ],
    };

    const collectionNode: Record<string, any> = {
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    if (categoryVerifiedProducts.length > 0) {
      collectionNode.mainEntity = {
        '@type': 'ItemList',
        itemListElement: categoryVerifiedProducts.map((p, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `${origin}/menu/${p.slug}`,
          name: p.name,
        })),
      };
    }

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: category.noindex ? 'noindex, follow' : 'index, follow',
      ogType: 'website',
      ogImage: buildAbsoluteUrl(origin, category.imageUrl || defaultHeroImg),
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, collectionNode, breadcrumbNode],
      },
      ssrBodyHtml: `
        <main id="ssr-public-content" class="max-w-7xl mx-auto px-4 py-10 space-y-6">
          <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/menu">Menu</a> &rsaquo; <span>${escapeHtml(category.name)}</span></nav>
          <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(category.name)} in Renukoot</h1>
          <p>${escapeHtml(description)}</p>
          ${
            categoryVerifiedProducts.length > 0
              ? `<ul class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  ${categoryVerifiedProducts
                    .map(
                      (p) => `<li>
                        <a href="/menu/${escapeHtml(p.slug)}" class="block p-4 border rounded-xl">
                          <strong>${escapeHtml(p.name)}</strong> — ₹${Number(p.price ?? p.basePrice ?? 0)}
                          <p class="text-sm">${escapeHtml(p.description || '')}</p>
                        </a>
                      </li>`
                    )
                    .join('')}
                </ul>`
              : `<p>Looking for a custom order in ${escapeHtml(category.name)}? <a href="/custom-cake" class="underline font-semibold">Configure a Custom Cake</a> or call ${escapeHtml(settings.phone)}.</p>`
          }
        </main>
      `,
    };
  }

  // 9. PRODUCT DETAIL PAGES (/menu/:slug, /cakes/:slug, /products/:slug)
  if (
    basePath.startsWith('/menu/') ||
    basePath.startsWith('/cakes/') ||
    basePath.startsWith('/products/')
  ) {
    const slug = basePath
      .replace(/^\/(menu|cakes|products)\//, '')
      .trim();

    const product = products.find((p) => p.slug === slug && !p.isArchived);
    const cakeDesign = !product
      ? cakeDesigns.find((d) => d.slug === slug && d.isActive)
      : undefined;

    if (!product && !cakeDesign) {
      return {
        httpStatus: 404,
        lang,
        htmlLang,
        normalizedPath: cleanUrlPath,
        basePath,
        title: `Product Not Found (404) | ${settings.businessName}`,
        description: `The requested cake or bakery item could not be found at ${settings.businessName}, Renukoot.`,
        canonicalUrl: `${origin}${basePath}`,
        robots: 'noindex, nofollow',
        ogType: 'website',
        ogImage: defaultHeroImg,
        jsonLdGraph: { '@context': 'https://schema.org', '@graph': [websiteNode] },
        ssrBodyHtml: `<main class="max-w-4xl mx-auto px-4 py-16"><h1>404 — Product Not Found</h1><p>This item is not available. <a href="/menu" class="underline">Browse our Menu</a> or <a href="/custom-cake" class="underline">Order a Custom Cake</a>.</p></main>`,
      };
    }

    if (product) {
      const isVerifiedPublic = isProductOwnerVerifiedAndPublished(product);
      const isCakeCat = (product.categorySlug || product.categoryId || '').includes('cake');
      const canonicalPath = isCakeCat ? `/cakes/${product.slug}` : `/menu/${product.slug}`;
      const canonicalUrl = product.canonicalUrl || `${origin}${canonicalPath}`;
      const title =
        product.seoTitle ||
        `${product.name} in Renukoot | Lovey's Bakery & Pizza Corners`;
      const description =
        product.seoDescription ||
        `${product.description || product.shortDescription || product.name} Available at Lovey's Bakery & Pizza Corners, Renukoot, Sonbhadra.`;

      const parentCat = categories.find(
        (c) => c.id === product.categoryId || c.slug === product.categorySlug
      );

      const breadcrumbNode = {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: parentCat ? parentCat.name : 'Menu',
            item: parentCat ? `${origin}/categories/${parentCat.slug}` : `${origin}/menu`,
          },
          { '@type': 'ListItem', position: 3, name: product.name, item: canonicalUrl },
        ],
      };

      const graphNodes: Record<string, any>[] = [
        localBusinessNode,
        websiteNode,
        breadcrumbNode,
      ];

      // Phase 6B & Phase 8: Only emit Product / ProductGroup schema when the product is owner-verified & published
      if (isVerifiedPublic) {
        const basePrice = Number(product.price ?? product.basePrice ?? 0);
        const variants = parseVariantOptions(product.variantsSummary || '');
        const productImg = buildAbsoluteUrl(origin, product.imageUrl || defaultHeroImg);
        const availabilityUrl = product.isAvailable
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock';

        if (variants.length > 1) {
          graphNodes.push({
            '@type': 'ProductGroup',
            '@id': `${canonicalUrl}#productgroup`,
            name: product.name,
            description: product.description || description,
            url: canonicalUrl,
            image: productImg,
            productGroupID: product.id,
            brand: {
              '@type': 'Brand',
              name: settings.businessName || "Lovey's Bakery & Pizza Corners",
            },
            variesBy: ['https://schema.org/size'],
            hasVariant: variants.map((v, idx) => ({
              '@type': 'Product',
              sku: `${product.id}-v${idx + 1}`,
              name: `${product.name} (${v.label})`,
              image: productImg,
              description: product.description || description,
              offers: {
                '@type': 'Offer',
                url: canonicalUrl,
                priceCurrency: 'INR',
                price: String(Math.max(0, basePrice + v.priceDelta)),
                availability: availabilityUrl,
                seller: { '@id': businessId },
              },
            })),
          });
        } else {
          graphNodes.push({
            '@type': 'Product',
            '@id': `${canonicalUrl}#product`,
            sku: product.id,
            name: product.name,
            description: product.description || description,
            image: productImg,
            url: canonicalUrl,
            brand: {
              '@type': 'Brand',
              name: settings.businessName || "Lovey's Bakery & Pizza Corners",
            },
            offers: {
              '@type': 'Offer',
              url: canonicalUrl,
              priceCurrency: 'INR',
              price: String(basePrice),
              availability: availabilityUrl,
              seller: { '@id': businessId },
            },
          });
        }
      }

      return {
        httpStatus: 200,
        lang,
        htmlLang,
        normalizedPath: cleanUrlPath,
        basePath,
        title,
        description,
        canonicalUrl,
        // Phase 8: Unverified starter records MUST be noindex
        robots: isVerifiedPublic ? 'index, follow' : 'noindex, nofollow',
        ogType: 'product',
        ogImage: buildAbsoluteUrl(origin, product.imageUrl || defaultHeroImg),
        jsonLdGraph: {
          '@context': 'https://schema.org',
          '@graph': graphNodes,
        },
        ssrBodyHtml: `
          <main id="ssr-public-content" class="max-w-5xl mx-auto px-4 py-10 space-y-6">
            <nav aria-label="Breadcrumb">
              <a href="/">Home</a> &rsaquo;
              <a href="${parentCat ? `/categories/${escapeHtml(parentCat.slug)}` : '/menu'}">${escapeHtml(parentCat ? parentCat.name : 'Menu')}</a> &rsaquo;
              <span>${escapeHtml(product.name)}</span>
            </nav>
            <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(product.name)}</h1>
            ${!isVerifiedPublic ? `<p class="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">Catalogue Preview Item — Pending Owner Menu Verification</p>` : ''}
            <p>${escapeHtml(product.description || '')}</p>
            <p><strong>Base Price:</strong> ₹${Number(product.price ?? product.basePrice ?? 0)} INR</p>
            <p><strong>Availability:</strong> ${product.isAvailable ? 'Available to Order' : 'Currently Sold Out'}</p>
          </main>
        `,
      };
    }

    if (cakeDesign) {
      const isVerifiedDesign = isCakeDesignOwnerVerifiedAndPublished(cakeDesign);
      const designName = cakeDesign.name || cakeDesign.title || 'Custom Cake Design';
      const canonicalUrl =
        cakeDesign.canonicalUrl || `${origin}/cakes/${cakeDesign.slug}`;
      const title =
        cakeDesign.seoTitle ||
        `${designName} | Custom Cake in Renukoot — Lovey's`;
      const description =
        cakeDesign.seoDescription ||
        `${cakeDesign.description} Configure this custom cake design at Lovey's Bakery & Pizza Corners, Renukoot.`;

      return {
        httpStatus: 200,
        lang,
        htmlLang,
        normalizedPath: cleanUrlPath,
        basePath,
        title,
        description,
        canonicalUrl,
        robots: isVerifiedDesign ? 'index, follow' : 'noindex, nofollow',
        ogType: 'product',
        ogImage: buildAbsoluteUrl(origin, cakeDesign.imageUrl || defaultHeroImg),
        jsonLdGraph: {
          '@context': 'https://schema.org',
          '@graph': [localBusinessNode, websiteNode],
        },
        ssrBodyHtml: `
          <main id="ssr-public-content" class="max-w-5xl mx-auto px-4 py-10 space-y-6">
            <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/cakes">Cakes</a> &rsaquo; <span>${escapeHtml(designName)}</span></nav>
            <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(designName)}</h1>
            <p>${escapeHtml(cakeDesign.description)}</p>
            <p><a href="/custom-cake" class="underline font-semibold">Customise this cake in our Custom Cake Studio &rarr;</a></p>
          </main>
        `,
      };
    }
  }

  // 10. CUSTOM PUBLIC CMS PAGES & LOCAL GUIDES (/about, /delivery-policy, /cancellation-policy, /privacy-policy, /terms, /cake-ordering-guide)
  const pageSlug = basePath.replace(/^\/+/, '');
  const matchedCustomPage = customPages.find(
    (pg) => pg.slug === pageSlug && pg.isPublished
  );

  if (matchedCustomPage) {
    const isAbout = pageSlug === 'about';
    const canonicalUrl =
      matchedCustomPage.canonicalUrl ||
      (isAbout && lang === 'hi'
        ? `${origin}/hi/about`
        : `${origin}/${matchedCustomPage.slug}`);

    const title =
      lang === 'hi' && matchedCustomPage.titleHi
        ? `${matchedCustomPage.titleHi} | लवी'स बेकरी रेणुकूट`
        : matchedCustomPage.seoTitle ||
          `${matchedCustomPage.title} | Lovey's Bakery & Pizza Corners`;
    const description =
      matchedCustomPage.seoDescription ||
      matchedCustomPage.subtitle ||
      matchedCustomPage.content.slice(0, 155);

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: matchedCustomPage.title,
          item: canonicalUrl,
        },
      ],
    };

    const webPageNode = {
      '@type': isAbout ? 'AboutPage' : 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      dateModified: matchedCustomPage.updatedAt || '2026-11-20T00:00:00.000Z',
      isPartOf: { '@id': websiteId },
      about: { '@id': businessId },
      inLanguage: htmlLang,
    };

    return {
      httpStatus: 200,
      lang,
      htmlLang,
      normalizedPath: cleanUrlPath,
      basePath,
      title,
      description,
      canonicalUrl,
      robots: matchedCustomPage.noindex ? 'noindex, follow' : 'index, follow',
      ogType: 'article',
      ogImage: buildAbsoluteUrl(
        origin,
        matchedCustomPage.heroImageUrl || defaultHeroImg
      ),
      hreflangEnUrl: isAbout ? `${origin}/about` : undefined,
      hreflangHiUrl: isAbout ? `${origin}/hi/about` : undefined,
      hreflangDefaultUrl: isAbout ? `${origin}/about` : undefined,
      jsonLdGraph: {
        '@context': 'https://schema.org',
        '@graph': [localBusinessNode, websiteNode, webPageNode, breadcrumbNode],
      },
      ssrBodyHtml: `
        <main id="ssr-public-content" class="max-w-4xl mx-auto px-4 py-10 space-y-6">
          <nav aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>${escapeHtml(matchedCustomPage.title)}</span></nav>
          <h1 class="text-3xl sm:text-4xl font-serif font-bold">${escapeHtml(lang === 'hi' && matchedCustomPage.titleHi ? matchedCustomPage.titleHi : matchedCustomPage.title)}</h1>
          ${matchedCustomPage.subtitle ? `<p class="text-lg text-[#6B544E]">${escapeHtml(lang === 'hi' && matchedCustomPage.subtitleHi ? matchedCustomPage.subtitleHi : matchedCustomPage.subtitle)}</p>` : ''}
          <div class="prose max-w-none whitespace-pre-line">${escapeHtml(lang === 'hi' && matchedCustomPage.contentHi ? matchedCustomPage.contentHi : matchedCustomPage.content)}</div>
          <footer class="pt-6 border-t text-xs text-[#6B544E]">
            Published by ${escapeHtml(settings.businessName)} (${escapeHtml(settings.address)}) · Last Updated: ${escapeHtml((matchedCustomPage.updatedAt || '').slice(0, 10))}
          </footer>
        </main>
      `,
    };
  }

  // 11. UNKNOWN ROUTE -> GENUINE HTTP 404 (Phase 22D: No Soft-404s)
  return {
    httpStatus: 404,
    lang,
    htmlLang,
    normalizedPath: cleanUrlPath,
    basePath,
    title: `Page Not Found (404) | ${settings.businessName}`,
    description: `The requested page could not be found on ${settings.businessName}, Renukoot.`,
    canonicalUrl: `${origin}${cleanUrlPath}`,
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogImage: defaultHeroImg,
    jsonLdGraph: {
      '@context': 'https://schema.org',
      '@graph': [websiteNode],
    },
    ssrBodyHtml: `
      <main id="ssr-public-content" class="max-w-4xl mx-auto px-4 py-16 space-y-4">
        <h1 class="text-3xl font-serif font-bold">404 — Page Not Found</h1>
        <p>The page you requested does not exist at ${escapeHtml(settings.businessName)}, Renukoot.</p>
        <p><a href="/" class="underline font-semibold">Return to Homepage</a> · <a href="/menu" class="underline font-semibold">Explore Menu</a> · <a href="/custom-cake" class="underline font-semibold">Custom Cake Studio</a></p>
      </main>
    `,
  };
}
