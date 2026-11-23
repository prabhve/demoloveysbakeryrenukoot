export const GENERATED_IMAGES = {
  heroBakery: '/assets/hero/loveys-hero-spread.jpg',
  customCake: '/assets/cakes/loveys-tier-celebration-cake.jpg',
  chocolateTruffle: '/assets/cakes/loveys-chocolate-truffle-gateau.jpg',
  pizzaQuickBites: '/assets/pizza/loveys-stone-baked-pizza.jpg',
  pastriesCollection: '/assets/bakery/loveys-pastries-cookies.jpg',
  storeTable: '/assets/store/loveys-bakery-table.jpg',
};

export interface BusinessSettingsData {
  businessName: string;
  hindiName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  address: string;
  openingHours: string;
  holidayNotice: string;
  announcementText: string;
  announcementTextHi?: string;
  announcementActive?: boolean;
  heroBannerUrl?: string;
  googleMapsUrl?: string;
  facebookUrl?: string;
  ourStoryContent: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  codEnabled: boolean;
  payAtStoreEnabled: boolean;
  onlinePaymentEnabled: boolean;
  taxPercentage: number;
  packagingCharge: number;
  minDeliveryOrder: number;
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  coordinatesLat?: number;
  coordinatesLng?: number;
  coordinatesVerifiedByOwner?: boolean;
  openingHoursVerifiedByOwner?: boolean;
  googleReviewUrl?: string;
  weeklyHoursJson?: string;
}

export type BusinessSettings = BusinessSettingsData;

export type CataloguePublicationStatus =
  | 'draft'
  | 'needs_owner_verification'
  | 'approved'
  | 'published'
  | 'archived';

export interface CategoryItem {
  id: string;
  name: string;
  hindiName?: string;
  nameHi?: string;
  slug: string;
  description: string;
  descriptionHi?: string;
  imageUrl: string;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  sortOrder?: number;
  displayOrder?: number;
  isActive: boolean;
  updatedAt?: string;
}

export interface ProductVariantOption {
  label: string;
  priceDelta: number;
}

export interface ProductAddonOption {
  label: string;
  price: number;
}

export interface ProductItem {
  id: string;
  name: string;
  hindiName?: string;
  nameHi?: string;
  slug: string;
  categoryId: string;
  categorySlug?: string;
  categoryName?: string;
  description?: string;
  descriptionHi?: string;
  shortDescription?: string;
  fullDescription?: string;
  ingredientsSummary?: string;
  allergenInfo?: string;
  price?: number;
  basePrice?: number;
  originalPrice?: number;
  compareAtPrice?: number;
  discountLabel?: string;
  taxPercentage?: number;
  imageUrl: string;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  publicationStatus?: CataloguePublicationStatus;
  provenance?: 'sample_seed' | 'owner_created' | 'owner_verified';
  ownerVerifiedAt?: string;
  updatedAt?: string;
  variantsSummary: string; // Sizes / Weights: "500g:0|1 kg:480|1.5 kg:940|2 kg:1400"
  flavorsSummary: string; // Flavors: "Belgian Chocolate:0|Fresh Rasmalai:120|Red Velvet:90"
  frostingsSummary: string; // Frostings: "Whipped Cream:0|Swiss Buttercream:80|Dark Ganache:110"
  addonsSummary: string; // Add-ons: "Sparkle Candle:40|Birthday Topper:60"
  isAvailable: boolean;
  isPublished?: boolean;
  isBestseller: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isEggless: boolean;
  containsEgg?: boolean;
  isJainFriendly?: boolean;
  spiceLevel?: string;
  sameDayAvailable?: boolean;
  advanceNoticeHours?: number;
  stockQuantity?: number;
  minStockThreshold?: number;
  reservedStock?: number;
  isArchived?: boolean;
  isVeg?: boolean;
  badge?: string;
  prepTimeMinutes?: number;
}

export interface CakeDesignItem {
  id: string;
  name?: string;
  title?: string;
  hindiName?: string;
  slug?: string;
  theme?: string;
  occasion?: string;
  description: string;
  descriptionHi?: string;
  imageUrl: string;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  publicationStatus?: CataloguePublicationStatus;
  provenance?: 'sample_seed' | 'owner_created' | 'owner_verified';
  ownerVerifiedAt?: string;
  updatedAt?: string;
  basePrice?: number;
  startingPrice?: number;
  minWeightKg?: number;
  maxWeightKg?: number;
  availableFlavours?: string;
  leadTimeHours?: number;
  decorationCharge?: number;
  isQuotationBased: boolean;
  weightsAllowed?: string;
  flavoursAllowed?: string;
  fillingsAllowed?: string;
  frostingsAllowed?: string;
  prepTimeHours?: number;
  advanceBookingHours?: number;
  isActive: boolean;
}

export interface MediaAssetItem {
  id: string;
  title: string;
  altText: string;
  category?: string;
  section?: string;
  mediaType?: 'image' | 'video';
  url?: string;
  imageUrl?: string;
  aspectRatio: string;
  width?: number;
  height?: number;
  provenance?: 'sample_seed' | 'owner_uploaded' | 'owner_verified';
  ownerVerified?: boolean;
  sortOrder?: number;
  displayOrder?: number;
  isVisible?: boolean;
  isFeatured?: boolean;
  updatedAt?: string;
}

export interface CouponItem {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed' | 'flat';
  discountValue: number;
  minCartValue: number;
  maxUsage: number;
  usedCount: number;
  expiryDate?: string;
  isActive: boolean;
}

export interface DeliveryZoneItem {
  id: string;
  pinCode: string;
  localityName: string;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedMinutes?: number;
  estimatedTime?: string;
  isServiceable: boolean;
}

export interface DiningTableItem {
  id: string;
  tableNumber: string;
  label: string;
  capacity: number;
  isActive: boolean;
  isOccupied: boolean;
  qrUrl: string;
}

export function parseVariantOptions(summary: string): ProductVariantOption[] {
  if (!summary || !summary.trim()) return [];
  return summary
    .split('|')
    .map((segment) => {
      const [labelPart, deltaPart] = segment.split(':');
      const label = (labelPart || '').trim();
      const priceDelta = Number(deltaPart || 0);
      return {
        label,
        priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
      };
    })
    .filter((opt) => opt.label.length > 0);
}

export function parseAddonOptions(summary: string): ProductAddonOption[] {
  if (!summary || !summary.trim()) return [];
  return summary
    .split('|')
    .map((segment) => {
      const [labelPart, pricePart] = segment.split(':');
      const label = (labelPart || '').trim();
      const price = Number(pricePart || 0);
      return {
        label,
        price: Number.isFinite(price) ? price : 0,
      };
    })
    .filter((opt) => opt.label.length > 0);
}

export const INITIAL_BUSINESS_SETTINGS: BusinessSettingsData = {
  businessName: "Lovey's Bakery & Pizza Corners",
  hindiName: "लवी'स बेकरी & पिज्जा कॉर्नर्स",
  tagline: 'Freshly Baked. Beautifully Celebrated.',
  phone: '+91 80905 29971',
  whatsapp: '918090529971',
  address:
    'In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, Uttar Pradesh 231217, India',
  openingHours: 'Daily: 10:00 AM – 10:00 PM (Configurable by Owner)',
  holidayNotice: '',
  announcementText:
    'Freshly baked custom celebration cakes, artisan pizzas & takeaway parcels in Renukoot · Free delivery above ₹799 in serviceable zones',
  announcementTextHi:
    'रेणुकूट में ताज़ा बेक किए गए कस्टम सेलिब्रेशन केक, पिज़्ज़ा और टेकअवे पार्सल · ₹799 से अधिक के ऑर्डर पर मुफ़्त होम डिलीवरी',
  announcementActive: true,
  heroBannerUrl: GENERATED_IMAGES.heroBakery,
  googleMapsUrl: "https://www.google.com/maps/place/Lovey's+Bakery+%26+Pizza+Corners/",
  facebookUrl: 'https://www.facebook.com/loveysbakeryandpizzacorner/',
  ourStoryContent:
    "Located in front of Tiwari Hotel near Punjab National Bank in the heart of Renukoot, Sonbhadra, Lovey's Bakery & Pizza Corners is a welcoming neighbourhood bakery and café dedicated to making every celebration memorable.\n\nFrom signature chocolate truffle gateaux, classic Black Forest cakes, and bespoke multi-tier custom celebration cakes to freshly stone-baked pizzas, crispy Belgian waffles, burgers, and warm evening bakery snacks, our kitchen focuses on fresh daily preparation, thoughtful customisation, and genuine hospitality for families across Renukoot.\n\nEvery custom cake is handcrafted to your exact occasion, weight, flavour, frosting, and personal inscription — available for home delivery in serviceable Renukoot localities, express takeaway parcel pickup, or warm table service at our outlet.",
  deliveryEnabled: true,
  pickupEnabled: true,
  dineInEnabled: true,
  codEnabled: true,
  payAtStoreEnabled: true,
  onlinePaymentEnabled: false,
  taxPercentage: 5,
  packagingCharge: 20,
  minDeliveryOrder: 250,
  baseDeliveryFee: 40,
  freeDeliveryThreshold: 799,
  coordinatesLat: 24.2054,
  coordinatesLng: 83.0355,
  coordinatesVerifiedByOwner: false,
  openingHoursVerifiedByOwner: false,
  googleReviewUrl: '',
};

export const INITIAL_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat-birthday-cakes',
    name: 'Birthday Cakes',
    hindiName: 'बर्थडे केक',
    slug: 'birthday-cakes',
    description: 'Hand-crafted celebration cakes freshly layered for birthdays of every age.',
    descriptionHi: 'हर उम्र के जन्मदिन के लिए ताज़ा तैयार किए गए सेलिब्रेशन केक।',
    imageUrl: GENERATED_IMAGES.heroBakery,
    imageAlt: "Birthday celebration cakes at Lovey's Bakery & Pizza Corners, Renukoot",
    seoTitle: "Birthday Cakes in Renukoot | Lovey's Bakery & Pizza Corners",
    seoDescription:
      "Order fresh birthday cakes in Renukoot, Sonbhadra from Lovey's Bakery & Pizza Corners, in front of Tiwari Hotel near Punjab National Bank.",
    sortOrder: 1,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-designer-cakes',
    name: 'Designer Cakes',
    hindiName: 'डिज़ाइनर केक',
    slug: 'designer-cakes',
    description: 'Bespoke multi-tier and themed studio cakes tailored to your occasion.',
    descriptionHi: 'आपके खास अवसर के अनुसार कस्टम मल्टी-टियर और थीम डिज़ाइनर केक।',
    imageUrl: GENERATED_IMAGES.customCake,
    imageAlt: "Custom multi-tier designer cakes in Renukoot at Lovey's Bakery",
    seoTitle: "Designer & Theme Cakes in Renukoot | Lovey's Bakery",
    seoDescription:
      "Explore custom multi-tier and designer theme cakes in Renukoot, Sonbhadra at Lovey's Bakery & Pizza Corners.",
    sortOrder: 2,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-chocolate-cakes',
    name: 'Chocolate Cakes',
    hindiName: 'चॉकलेट केक',
    slug: 'chocolate-cakes',
    description: 'Rich chocolate truffle, Dutch cocoa gateaux, and classic Black Forest creations.',
    descriptionHi: 'रिच चॉकलेट ट्रफल, डच कोको केक और क्लासिक ब्लैक फॉरेस्ट केक।',
    imageUrl: GENERATED_IMAGES.chocolateTruffle,
    imageAlt: "Chocolate truffle and Black Forest cakes in Renukoot at Lovey's Bakery",
    seoTitle: "Chocolate Truffle & Black Forest Cakes in Renukoot | Lovey's",
    seoDescription:
      "Order chocolate truffle gateaux and Black Forest celebration cakes in Renukoot from Lovey's Bakery & Pizza Corners.",
    sortOrder: 3,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-anniversary-cakes',
    name: 'Anniversary Cakes',
    hindiName: 'एनिवर्सरी केक',
    slug: 'anniversary-cakes',
    description: 'Elegant floral, berry, and gold-accented cakes for milestone celebrations.',
    descriptionHi: 'शादी की सालगिरह और खास अवसरों के लिए आकर्षक सेलिब्रेशन केक।',
    imageUrl: GENERATED_IMAGES.customCake,
    imageAlt: "Anniversary celebration cakes in Renukoot at Lovey's Bakery",
    seoTitle: "Anniversary & Milestone Celebration Cakes in Renukoot | Lovey's",
    seoDescription:
      "Celebrate anniversaries and milestones in Renukoot with handcrafted tiered cakes from Lovey's Bakery & Pizza Corners.",
    sortOrder: 4,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-custom-cakes',
    name: 'Custom Cakes',
    hindiName: 'कस्टम केक',
    slug: 'custom-cakes',
    description: 'Personalised weight, flavour, filling, and inscription crafted to order.',
    descriptionHi: 'आपकी पसंद के वजन, फ्लेवर, फिलिंग और नाम के साथ कस्टम केक।',
    imageUrl: GENERATED_IMAGES.customCake,
    imageAlt: "Custom order cakes in Renukoot at Lovey's Bakery & Pizza Corners",
    seoTitle: "Custom Cake Orders in Renukoot | Lovey's Bakery & Pizza Corners",
    seoDescription:
      "Configure custom cake weight, flavour, frosting, and personalized message online at Lovey's Bakery & Pizza Corners in Renukoot.",
    sortOrder: 5,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-pastries-desserts',
    name: 'Pastries & Desserts',
    hindiName: 'पेस्ट्री और डेज़र्ट',
    slug: 'pastries-desserts',
    description: 'Single-serve truffle slices, berry tarts, and freshly baked flaky pastries.',
    descriptionHi: 'ताज़ा बेक की गई ट्रफल पेस्ट्री, बेरी टार्ट और डेज़र्ट।',
    imageUrl: GENERATED_IMAGES.pastriesCollection,
    imageAlt: "Fresh pastries and desserts at Lovey's Bakery in Renukoot",
    seoTitle: "Pastries & Bakery Desserts in Renukoot | Lovey's Bakery",
    seoDescription:
      "Freshly prepared pastries, tarts, and bakery desserts available for takeaway, dine-in, and delivery in Renukoot.",
    sortOrder: 6,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-pizza',
    name: 'Pizza',
    hindiName: 'पिज़्ज़ा',
    slug: 'pizza',
    description: 'Freshly stone-baked pizzas with bubbling mozzarella and garden toppings.',
    descriptionHi: 'ताज़ा बेक किए गए चीज़ और वेजिटेबल पिज़्ज़ा।',
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: "Freshly baked pizzas at Lovey's Bakery & Pizza Corners in Renukoot",
    seoTitle: "Pizza Corner in Renukoot | Lovey's Bakery & Pizza Corners",
    seoDescription:
      "Order freshly baked pizzas for dine-in, takeaway parcel, or home delivery in Renukoot from Lovey's Bakery & Pizza Corners.",
    sortOrder: 7,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-burgers',
    name: 'Burgers',
    hindiName: 'बर्गर',
    slug: 'burgers',
    description: 'Toasted brioche burgers with crispy patties, cheese, and house sauces.',
    descriptionHi: 'क्रिस्पी पैटी और चीज़ के साथ ताज़ा बर्गर।',
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: "Crispy burgers at Lovey's Bakery & Pizza Corners, Renukoot",
    seoTitle: "Burgers & Quick Bites in Renukoot | Lovey's Bakery & Pizza Corners",
    seoDescription:
      "Order burgers and café quick bites in Renukoot near Tiwari Hotel and Punjab National Bank.",
    sortOrder: 8,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-waffles',
    name: 'Waffles',
    hindiName: 'वाफल्स',
    slug: 'waffles',
    description: 'Crispy golden Belgian waffles topped with warm chocolate, berries, and cream.',
    descriptionHi: 'गर्म चॉकलेट और क्रीम के साथ क्रिस्पी बेल्जियन वाफल्स।',
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: "Belgian waffles at Lovey's Bakery & Pizza Corners in Renukoot",
    seoTitle: "Crispy Waffles & Desserts in Renukoot | Lovey's Bakery",
    seoDescription:
      "Enjoy freshly baked crispy waffles with chocolate and toppings at Lovey's Bakery & Pizza Corners in Renukoot.",
    sortOrder: 9,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-bakery-snacks',
    name: 'Bakery Snacks',
    hindiName: 'बेकरी स्नैक्स',
    slug: 'bakery-snacks',
    description: 'Savory puffs, stuffed buns, and warm oven-fresh evening snacks.',
    descriptionHi: 'ताज़ा बेक किए गए पफ, बन और शाम के बेकरी स्नैक्स।',
    imageUrl: GENERATED_IMAGES.pastriesCollection,
    imageAlt: "Evening bakery snacks and puffs at Lovey's Bakery, Renukoot",
    seoTitle: "Bakery Snacks & Savory Bites in Renukoot | Lovey's Bakery",
    seoDescription:
      "Fresh bakery snacks, puffs, and takeaway bites in Renukoot, Sonbhadra at Lovey's Bakery & Pizza Corners.",
    sortOrder: 10,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-biscuits-cookies',
    name: 'Biscuits & Cookies',
    hindiName: 'बिस्कुट और कुकीज़',
    slug: 'biscuits-cookies',
    description: 'Small-batch butter cookies, almond shortbread, and bakery biscuits.',
    descriptionHi: 'बटर कुकीज़, बादाम बिस्कुट और बेकरी कुकीज़।',
    imageUrl: GENERATED_IMAGES.pastriesCollection,
    imageAlt: "Bakery biscuits and butter cookies at Lovey's Bakery, Renukoot",
    seoTitle: "Bakery Biscuits & Cookies in Renukoot | Lovey's Bakery",
    seoDescription:
      "Freshly baked butter cookies and bakery biscuits available at Lovey's Bakery & Pizza Corners in Renukoot.",
    sortOrder: 11,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-beverages',
    name: 'Beverages',
    hindiName: 'पेय पदार्थ',
    slug: 'beverages',
    description: 'Cold coffees, thick shakes, and warm café beverages.',
    descriptionHi: 'कोल्ड कॉफ़ी, शेक और कैफ़े बेवरेजेज।',
    imageUrl: GENERATED_IMAGES.storeTable,
    imageAlt: "Café beverages and shakes at Lovey's Bakery & Pizza Corners, Renukoot",
    seoTitle: "Café Beverages & Shakes in Renukoot | Lovey's Bakery",
    seoDescription:
      "Pair your cake or pizza with cold coffees and shakes at Lovey's Bakery & Pizza Corners in Renukoot.",
    sortOrder: 12,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'cat-combos-offers',
    name: 'Combos & Offers',
    hindiName: 'कॉम्बो और ऑफर्स',
    slug: 'combos-offers',
    description: 'Curated celebration and party packs combining cakes, pizzas, and snacks.',
    descriptionHi: 'केक, पिज़्ज़ा और स्नैक्स के सेलिब्रेशन और पार्टी कॉम्बो पैक।',
    imageUrl: GENERATED_IMAGES.heroBakery,
    imageAlt: "Celebration party combos at Lovey's Bakery & Pizza Corners, Renukoot",
    seoTitle: "Party & Celebration Combos in Renukoot | Lovey's Bakery",
    seoDescription:
      "Order cake and pizza party combos in Renukoot from Lovey's Bakery & Pizza Corners.",
    sortOrder: 13,
    isActive: true,
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
];

export const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-belgian-chocolate-truffle-cake',
    name: 'Signature Dark Chocolate Truffle Gateau',
    hindiName: 'सिग्नेचर डार्क चॉकलेट ट्रफल केक',
    slug: 'signature-dark-chocolate-truffle-gateau',
    categoryId: 'cat-chocolate-cakes',
    categorySlug: 'chocolate-cakes',
    description:
      'Moist Dutch-cocoa sponge layered with silky dark chocolate ganache, hand-curled chocolate shavings, and dark cherries.',
    price: 540,
    originalPrice: 600,
    imageUrl: GENERATED_IMAGES.chocolateTruffle,
    imageAlt: 'Signature Dark Chocolate Truffle Gateau with chocolate curls and cherries',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: '500g:0|1 kg:480|1.5 kg:940|2 kg:1400',
    flavorsSummary:
      'Belgian Dark Truffle:0|Dutch Hazelnut Praline:110|Chocolate Cherry Forest:70|Espresso Mocha Truffle:90',
    frostingsSummary:
      'Silky Dark Chocolate Ganache:0|Dutch Cocoa Whipped Cream:0|Swiss Chocolate Buttercream:80',
    addonsSummary: 'Sparkle Candle:40|Happy Birthday Acrylic Topper:70|Chocolate Plaque:50',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 45,
  },
  {
    id: 'prod-classic-black-forest-celebration',
    name: 'Classic Black Forest Berry Celebration Cake',
    hindiName: 'क्लासिक ब्लैक फॉरेस्ट सेलिब्रेशन केक',
    slug: 'classic-black-forest-berry-celebration-cake',
    categoryId: 'cat-birthday-cakes',
    categorySlug: 'birthday-cakes',
    description:
      'Light chocolate sponge layered with Madagascar vanilla whipped cream, cherry compote, and fresh seasonal berries.',
    price: 460,
    originalPrice: 520,
    imageUrl: GENERATED_IMAGES.heroBakery,
    imageAlt: 'Classic Black Forest Berry Celebration Cake topped with seasonal berries',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: '500g:0|1 kg:420|1.5 kg:820|2 kg:1220',
    flavorsSummary:
      'Classic Black Forest Cherry:0|Mixed Berry Chocolate:80|Strawberry Vanilla Forest:60|Red Velvet Berry:110',
    frostingsSummary:
      'Madagascar Vanilla Whipped Cream:0|Semi-Naked Artisan Cream:40|Chocolate Ganache Drip Coat:90',
    addonsSummary: 'Birthday Candle Set:30|Anniversary Topper:70|Extra Berry Crown:90',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 45,
  },
  {
    id: 'prod-royal-ivory-pistachio-berry-cake',
    name: 'Ivory Pistachio & Raspberry Tiered Cake',
    hindiName: 'आइवरी पिस्ता और रास्पबेरी केक',
    slug: 'ivory-pistachio-raspberry-tiered-cake',
    categoryId: 'cat-anniversary-cakes',
    categorySlug: 'anniversary-cakes',
    description:
      'Velvety cardamom-infused sponge finished in warm ivory buttercream with roasted pistachio crumble and fresh berries.',
    price: 890,
    originalPrice: 980,
    imageUrl: GENERATED_IMAGES.customCake,
    imageAlt: 'Ivory Pistachio and Raspberry Tiered Celebration Cake',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: '1 kg (Single Tier):0|1.5 kg (Two Tier):550|2.5 kg (Two Tier):1450',
    flavorsSummary:
      'Pistachio Cardamom Rasmalai:0|White Chocolate Raspberry:90|Red Velvet Cream Cheese:100|Almond Rose Saffron:130',
    frostingsSummary:
      'Warm Ivory Swiss Buttercream:0|White Chocolate Ganache Finish:120|Light Whipped Cream:0',
    addonsSummary: 'Edible Gold Leaf Accent:120|Floral Ring Box Packaging:80|Custom Topper:75',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 120,
  },
  {
    id: 'prod-artisan-margherita-pizza',
    name: 'Stone-Baked Margherita & Fresh Basil Pizza',
    hindiName: 'स्टोन-बेक्ड मार्गरीटा पिज़्ज़ा',
    slug: 'stone-baked-margherita-fresh-basil-pizza',
    categoryId: 'cat-pizza',
    categorySlug: 'pizza',
    description:
      'Hand-stretched artisan dough topped with slow-simmered San Marzano style tomato sauce, mozzarella, roasted cherry tomatoes, and basil.',
    price: 240,
    originalPrice: 280,
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: 'Stone-Baked Margherita Pizza with mozzarella and fresh basil',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: 'Regular (8 inch):0|Medium (10 inch):110|Large (12 inch):220',
    flavorsSummary: 'Classic San Marzano & Basil:0|Garlic Herb Infused:30|Spicy Arrabbiata Base:35',
    frostingsSummary: 'Hand-Tossed Artisan Crust:0|Thin Crispy Romana Crust:20|Cheese Burst Crust:80',
    addonsSummary: 'Extra Mozzarella Cheese:50|Jalapeño & Black Olives:40|Chilli Garlic Oil Dip:25',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 20,
  },
  {
    id: 'prod-farmhouse-paneer-tikka-pizza',
    name: 'Tandoori Paneer & Roasted Bell Pepper Pizza',
    hindiName: 'तंदूरी पनीर और बेल पेपर पिज़्ज़ा',
    slug: 'tandoori-paneer-roasted-bell-pepper-pizza',
    categoryId: 'cat-pizza',
    categorySlug: 'pizza',
    description:
      'Spiced paneer cubes, crisp capsicum, red paprika, golden corn, and stretchy mozzarella on a freshly baked crust.',
    price: 290,
    originalPrice: 340,
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: 'Tandoori Paneer and Roasted Bell Pepper Pizza',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: 'Regular (8 inch):0|Medium (10 inch):120|Large (12 inch):240',
    flavorsSummary: 'Smoky Tandoori Tikka:0|Peri-Peri Paneer Spice:30|Makhani Butter Glaze:40',
    frostingsSummary: 'Hand-Tossed Artisan Crust:0|Fresh Pan Thick Crust:30|Cheese Burst Crust:85',
    addonsSummary: 'Extra Mozzarella Cheese:50|Extra Paneer Cubes:60|Peri-Peri Dip:30',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 25,
  },
  {
    id: 'prod-belgian-berry-chocolate-waffle',
    name: 'Crispy Belgian Waffle with Berry & Maple Drizzle',
    hindiName: 'क्रिस्पी बेल्जियन वाफल',
    slug: 'crispy-belgian-waffle-berry-maple',
    categoryId: 'cat-waffles',
    categorySlug: 'waffles',
    description:
      'Golden-baked waffle iron crisp exterior and warm fluffy interior served with berries, powdered sugar, and warm chocolate or maple.',
    price: 160,
    originalPrice: 190,
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: 'Crispy Belgian Waffle with fresh berries and drizzle',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: 'Single Square:0|Double Waffle Stack:110',
    flavorsSummary: 'Classic Vanilla Batter:0|Dark Cocoa Chocolate Batter:25|Red Velvet Batter:35',
    frostingsSummary: 'Warm Maple & Berry Compote:0|Belgian Dark Ganache Pour:35|Nutella Hazelnut Spread:55',
    addonsSummary: 'Vanilla Bean Ice Cream Scoop:45|Roasted Hazelnuts:30|Whipped Cream Cloud:25',
    isAvailable: true,
    isPublished: false,
    isBestseller: false,
    isEggless: true,
    prepTimeMinutes: 15,
  },
  {
    id: 'prod-hazelnut-chocolate-croissant-box',
    name: 'Hazelnut Praline Croissant & Berry Tart Box',
    hindiName: 'हेज़लनट क्रोइसैन और बेरी टार्ट बॉक्स',
    slug: 'hazelnut-praline-croissant-berry-tart-box',
    categoryId: 'cat-pastries-desserts',
    categorySlug: 'pastries-desserts',
    description:
      'Flaky laminated chocolate-hazelnut croissants paired with vanilla custard berry tarts baked fresh every morning.',
    price: 220,
    originalPrice: 260,
    imageUrl: GENERATED_IMAGES.pastriesCollection,
    imageAlt: 'Hazelnut Praline Croissant and Berry Tart Box',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: 'Box of 2:0|Box of 4:190|Box of 6:360',
    flavorsSummary: 'Assorted Croissant & Berry Tart:0|All Chocolate Hazelnut Croissants:20|All Fresh Berry Custard Tarts:30',
    frostingsSummary: 'Dark Chocolate Drizzle & Roasted Nuts:0|Dusted Icing Sugar Finish:0',
    addonsSummary: 'Gift Ribbon Box:30|Extra Chocolate Ganache Cup:35',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 15,
  },
  {
    id: 'prod-artisan-butter-almond-cookies',
    name: 'Hand-Crafted Almond & Jam Thumbprint Cookies',
    hindiName: 'हैंड-क्राफ्टेड बादाम और बटर कुकीज़',
    slug: 'hand-crafted-almond-jam-thumbprint-cookies',
    categoryId: 'cat-biscuits-cookies',
    categorySlug: 'biscuits-cookies',
    description:
      'Melt-in-mouth bakery shortbread and almond butter cookies filled with fruit preserves and toasted nuts.',
    price: 180,
    originalPrice: 210,
    imageUrl: GENERATED_IMAGES.pastriesCollection,
    imageAlt: 'Hand-Crafted Almond and Jam Thumbprint Cookies',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: '250g Pack:0|500g Gift Tin:160|1 kg Family Box:480',
    flavorsSummary: 'Assorted Almond & Berry Jam:0|Roasted Pistachio Jeera Mix:20|Double Choc Chip Shortbread:30',
    frostingsSummary: 'Classic Bakery Bake:0|Low-Sugar Jaggery Bake:35',
    addonsSummary: 'Festive Gift Tin Upgrade:50',
    isAvailable: true,
    isPublished: false,
    isBestseller: false,
    isEggless: true,
    prepTimeMinutes: 10,
  },
  {
    id: 'prod-crispy-cheese-herb-burger',
    name: 'Crispy Herb Patty & Cheddar Brioche Burger',
    hindiName: 'क्रिस्पी हर्ब पैटी और चीज़ बर्गर',
    slug: 'crispy-herb-patty-cheddar-brioche-burger',
    categoryId: 'cat-burgers',
    categorySlug: 'burgers',
    description:
      'House-baked buttered sesame bun with a golden herb-crusted vegetable patty, melted cheddar slice, lettuce, and smoky chipotle mayo.',
    price: 120,
    originalPrice: 145,
    imageUrl: GENERATED_IMAGES.pizzaQuickBites,
    imageAlt: 'Crispy Herb Patty and Cheddar Brioche Burger',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: 'Single Patty:0|Double Cheese & Double Patty:70',
    flavorsSummary: 'Crispy Herb Veg Patty:0|Spiced Paneer Crunch Patty:45',
    frostingsSummary: 'Smoky Chipotle Mayo:0|Classic Cheese & Mustard Glaze:15',
    addonsSummary: 'Extra Cheddar Slice:25|Peri-Peri Fries Side:75',
    isAvailable: true,
    isPublished: false,
    isBestseller: false,
    isEggless: true,
    prepTimeMinutes: 15,
  },
  {
    id: 'prod-celebration-party-combo',
    name: "Lovey's Celebration Feast Combo (Cake + Pizza + Pastries)",
    hindiName: 'लवीज़ सेलिब्रेशन पार्टी कॉम्बो',
    slug: 'loveys-celebration-feast-combo',
    categoryId: 'cat-combos-offers',
    categorySlug: 'combos-offers',
    description:
      'Complete celebration bundle: 500g Chocolate Truffle or Black Forest Cake + 1 Medium Margherita Pizza + 2 Berry Tarts.',
    price: 899,
    originalPrice: 1060,
    imageUrl: GENERATED_IMAGES.storeTable,
    imageAlt: "Lovey's Celebration Feast Combo with Cake, Pizza, and Pastries",
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    variantsSummary: 'With 500g Cake:0|Upgrade to 1 kg Cake:390',
    flavorsSummary: 'Belgian Chocolate Truffle Cake:0|Classic Black Forest Cake:0|Pineapple Berry Cake:0',
    frostingsSummary: 'Rich Ganache Finish:0|Whipped Cream Finish:0',
    addonsSummary: 'Party Candle & Knife Set:40|Extra Garlic Breadsticks:99',
    isAvailable: true,
    isPublished: false,
    isBestseller: true,
    isEggless: true,
    prepTimeMinutes: 45,
  },
];

export const INITIAL_CAKE_DESIGNS: CakeDesignItem[] = [
  {
    id: 'design-royal-ivory-gold-two-tier',
    name: 'Royal Ivory, Pistachio & Raspberry Two-Tier',
    slug: 'royal-ivory-pistachio-raspberry-two-tier',
    theme: 'Anniversary & Milestone',
    description:
      'Two-tier celebration centerpiece finished in smooth warm ivory cream, fresh berry crown, pistachio border, and delicate edible gold accents.',
    imageUrl: GENERATED_IMAGES.customCake,
    imageAlt: 'Royal Ivory, Pistachio and Raspberry Two-Tier Celebration Cake',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    basePrice: 1450,
    decorationCharge: 150,
    isQuotationBased: false,
    weightsAllowed: '1.5 kg,2.0 kg,3.0 kg,4.0 kg',
    flavoursAllowed:
      'Belgian Chocolate Truffle,Fresh Rasmalai Cardamom,Red Velvet Cream Cheese,Classic Black Forest,Butterscotch Praline,Pineapple Berry',
    fillingsAllowed:
      'Roasted Pistachio & White Ganache,Dark Chocolate Truffle,Fresh Berry Compote,Caramel Praline Crunch',
    frostingsAllowed: 'Swiss Meringue Buttercream,Light Whipped Cream,White Chocolate Ganache',
    prepTimeHours: 6,
    advanceBookingHours: 12,
    isActive: true,
  },
  {
    id: 'design-belgian-truffle-drip-crown',
    name: 'Belgian Dark Ganache Drip & Cherry Gateau',
    slug: 'belgian-dark-ganache-drip-cherry-gateau',
    theme: 'Birthday & Chocolate Lovers',
    description:
      'Decadent dark chocolate sponge enveloped in mirror-gloss chocolate ganache drip, hand-rolled chocolate curls, and dark cherries.',
    imageUrl: GENERATED_IMAGES.chocolateTruffle,
    imageAlt: 'Belgian Dark Ganache Drip and Cherry Gateau',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    basePrice: 580,
    decorationCharge: 80,
    isQuotationBased: false,
    weightsAllowed: '0.5 kg,1.0 kg,1.5 kg,2.0 kg',
    flavoursAllowed:
      'Belgian Chocolate Truffle,Dutch Hazelnut Ferrero,Classic Black Forest,Chocolate Orange Zest,Mocha Espresso',
    fillingsAllowed: 'Dark 55% Ganache,Hazelnut Gianduja Crunch,Morello Cherry Compote',
    frostingsAllowed: 'Rich Chocolate Ganache,Dutch Cocoa Whipped Cream',
    prepTimeHours: 3,
    advanceBookingHours: 4,
    isActive: true,
  },
  {
    id: 'design-rustic-berry-naked-forest',
    name: 'Artisan Berry Crown & Chocolate Naked Cake',
    slug: 'artisan-berry-crown-chocolate-naked-cake',
    theme: 'Rustic Celebration & Birthday',
    description:
      'European-style exposed sponge cake layered with dark chocolate cream, fresh raspberries, blackberries, blueberries, and edible petals.',
    imageUrl: GENERATED_IMAGES.heroBakery,
    imageAlt: 'Artisan Berry Crown and Chocolate Naked Cake',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    basePrice: 640,
    decorationCharge: 100,
    isQuotationBased: false,
    weightsAllowed: '0.5 kg,1.0 kg,1.5 kg,2.0 kg,2.5 kg',
    flavoursAllowed:
      'Chocolate Berry Forest,Vanilla Bean & Mixed Berry,Red Velvet Berry,Lemon Blueberry Velvet',
    fillingsAllowed: 'Fresh Mixed Berry Compote,Dark Chocolate Mousse,Mascarpone Cream',
    frostingsAllowed: 'Semi-Naked Artisan Frosting,Full Whipped Cream Coat',
    prepTimeHours: 4,
    advanceBookingHours: 6,
    isActive: true,
  },
  {
    id: 'design-bespoke-custom-theme-quotation',
    name: 'Bespoke Multi-Tier / Reference Photo Quotation Cake',
    slug: 'bespoke-multi-tier-reference-quotation-cake',
    theme: 'Custom Wedding / Kids Theme / Photo Reference',
    description:
      'Have a custom theme, fondant sculpture, or reference photograph in mind? Configure your specs and receive an exact owner quotation before payment.',
    imageUrl: GENERATED_IMAGES.customCake,
    imageAlt: 'Bespoke Multi-Tier Custom Theme Quotation Cake',
    publicationStatus: 'needs_owner_verification',
    provenance: 'sample_seed',
    noindex: true,
    basePrice: 1200,
    decorationCharge: 250,
    isQuotationBased: true,
    weightsAllowed: '1.0 kg,1.5 kg,2.0 kg,3.0 kg,5.0 kg',
    flavoursAllowed:
      'Belgian Chocolate Truffle,Fresh Rasmalai,Red Velvet,Butterscotch Crunch,Pineapple Berry,Lotus Biscoff,Custom Flavour Request',
    fillingsAllowed:
      'Dark Chocolate Ganache,Berry Compote,Hazelnut Praline,Biscoff Spread,Cream Cheese Frosting',
    frostingsAllowed: 'Fondant Art Finish,Swiss Buttercream,Whipped Cream with Fondant Accents',
    prepTimeHours: 24,
    advanceBookingHours: 24,
    isActive: true,
  },
];

export const INITIAL_MEDIA_ASSETS: MediaAssetItem[] = [
  {
    id: 'media-1',
    title: "Lovey's Morning Bake & Celebration Table",
    altText: "Artisan berry chocolate cake, stone-baked margherita pizza, croissants, and coffee at Lovey's Bakery in Renukoot",
    category: 'Store Photographs',
    mediaType: 'image',
    url: GENERATED_IMAGES.heroBakery,
    aspectRatio: '16:9',
    width: 1400,
    height: 900,
    provenance: 'sample_seed',
    ownerVerified: false,
    sortOrder: 1,
    isFeatured: true,
  },
  {
    id: 'media-2',
    title: 'Two-Tier Ivory Pistachio & Raspberry Celebration Cake',
    altText: "Two-tier custom cake with fresh raspberries, pistachio crumble, and gold leaf at Lovey's Bakery Renukoot",
    category: 'Celebration Orders',
    mediaType: 'image',
    url: GENERATED_IMAGES.customCake,
    aspectRatio: '4:3',
    width: 1200,
    height: 900,
    provenance: 'sample_seed',
    ownerVerified: false,
    sortOrder: 2,
    isFeatured: true,
  },
  {
    id: 'media-3',
    title: 'Signature Belgian Chocolate Truffle Gateau',
    altText: "Slice of rich dark chocolate truffle cake with ganache drip and cherries at Lovey's Bakery",
    category: 'Cakes',
    mediaType: 'image',
    url: GENERATED_IMAGES.chocolateTruffle,
    aspectRatio: '4:3',
    width: 1200,
    height: 900,
    provenance: 'sample_seed',
    ownerVerified: false,
    sortOrder: 3,
    isFeatured: true,
  },
  {
    id: 'media-4',
    title: 'Stone-Baked Margherita Pizza & Belgian Waffles',
    altText: "Freshly baked margherita pizza with basil alongside crispy golden waffles at Lovey's Pizza Corner Renukoot",
    category: 'Pizza & Food',
    mediaType: 'image',
    url: GENERATED_IMAGES.pizzaQuickBites,
    aspectRatio: '4:3',
    width: 1200,
    height: 900,
    provenance: 'sample_seed',
    ownerVerified: false,
    sortOrder: 4,
    isFeatured: true,
  },
  {
    id: 'media-5',
    title: 'Fresh Hazelnut Croissants, Berry Tarts & Butter Cookies',
    altText: "Bakery tray of chocolate croissants, fresh berry tarts, and almond shortbread cookies at Lovey's Bakery",
    category: 'Bakery Products',
    mediaType: 'image',
    url: GENERATED_IMAGES.pastriesCollection,
    aspectRatio: '4:3',
    width: 1200,
    height: 900,
    provenance: 'sample_seed',
    ownerVerified: false,
    sortOrder: 5,
    isFeatured: true,
  },
];

export const INITIAL_COUPONS: CouponItem[] = [
  {
    id: 'coup-loveys10',
    code: 'LOVEYS10',
    description: '10% off on celebration cakes and bakery orders above ₹400',
    discountType: 'percentage',
    discountValue: 10,
    minCartValue: 400,
    maxUsage: 500,
    usedCount: 12,
    isActive: true,
  },
  {
    id: 'coup-celebrate150',
    code: 'CELEBRATE150',
    description: 'Flat ₹150 off on custom cakes & party orders above ₹1,200',
    discountType: 'fixed',
    discountValue: 150,
    minCartValue: 1200,
    maxUsage: 200,
    usedCount: 5,
    isActive: true,
  },
  {
    id: 'coup-pizzacombo',
    code: 'PIZZACOMBO',
    description: 'Flat ₹60 off on Pizza & Waffle orders above ₹450',
    discountType: 'fixed',
    discountValue: 60,
    minCartValue: 450,
    maxUsage: 300,
    usedCount: 19,
    isActive: true,
  },
];

export const INITIAL_DELIVERY_ZONES: DeliveryZoneItem[] = [
  {
    id: 'zone-renukoot-main',
    pinCode: '231217',
    localityName: 'Renukoot Main Market / Tiwari Hotel / PNB Road',
    deliveryFee: 30,
    minOrderAmount: 200,
    estimatedMinutes: 30,
    isServiceable: true,
  },
  {
    id: 'zone-hindalco-colony',
    pinCode: '231217',
    localityName: 'Hindalco Colony / Hospital Road / Murdhawa',
    deliveryFee: 40,
    minOrderAmount: 250,
    estimatedMinutes: 35,
    isServiceable: true,
  },
  {
    id: 'zone-turra-pipri',
    pinCode: '231221',
    localityName: 'Pipri / Turra / Rihand Dam Road',
    deliveryFee: 60,
    minOrderAmount: 400,
    estimatedMinutes: 45,
    isServiceable: true,
  },
  {
    id: 'zone-anpara-unserviceable',
    pinCode: '231225',
    localityName: 'Anpara / Distant Outskirts (Store Pickup Only)',
    deliveryFee: 0,
    minOrderAmount: 0,
    estimatedMinutes: 0,
    isServiceable: false,
  },
];

export const INITIAL_DINING_TABLES: DiningTableItem[] = [
  {
    id: 'table-t01',
    tableNumber: 'T-01',
    label: 'Window Booth 1 (Front Bakery View)',
    capacity: 4,
    isActive: true,
    isOccupied: false,
    qrUrl: '/?table=T-01',
  },
  {
    id: 'table-t02',
    tableNumber: 'T-02',
    label: 'Window Booth 2',
    capacity: 4,
    isActive: true,
    isOccupied: false,
    qrUrl: '/?table=T-02',
  },
  {
    id: 'table-t03',
    tableNumber: 'T-03',
    label: 'Pizza Corner Couple Table 3',
    capacity: 2,
    isActive: true,
    isOccupied: false,
    qrUrl: '/?table=T-03',
  },
  {
    id: 'table-t04',
    tableNumber: 'T-04',
    label: 'Celebration Family Table 4',
    capacity: 6,
    isActive: true,
    isOccupied: false,
    qrUrl: '/?table=T-04',
  },
  {
    id: 'table-t05',
    tableNumber: 'T-05',
    label: 'Celebration Family Table 5',
    capacity: 6,
    isActive: true,
    isOccupied: false,
    qrUrl: '/?table=T-05',
  },
  {
    id: 'table-t06',
    tableNumber: 'T-06',
    label: 'Quick Bite Counter Table 6',
    capacity: 2,
    isActive: true,
    isOccupied: false,
    qrUrl: '/?table=T-06',
  },
];

export const PICKUP_TIME_SLOTS = [
  'Today · In 30 Minutes (Express)',
  'Today · 11:00 AM – 1:00 PM',
  'Today · 1:00 PM – 4:00 PM',
  'Today · 4:00 PM – 7:00 PM',
  'Today · 7:00 PM – 9:30 PM',
  'Tomorrow · 11:00 AM – 2:00 PM',
  'Tomorrow · 4:00 PM – 8:00 PM',
];

// ============================================================================
// MANUAL UPI ADVANCE PAYMENT & ORDER VERIFICATION SYSTEM TYPES & DEFAULTS
// ============================================================================

export type OrderPaymentStatus =
  | 'NOT_REQUIRED'
  | 'AWAITING_PAYMENT'
  | 'CONTACT_PENDING'
  | 'PAYMENT_SUBMITTED'
  | 'AWAITING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUESTED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface PaymentSettings {
  upiId: string;
  payeeDisplayName: string;
  qrCodeImageUrl: string;
  paymentInstructions: string;
  advanceType: 'percentage' | 'fixed';
  advancePercentage: number;
  fixedAdvanceAmount: number;
  minAdvanceAmount: number;
  maxAdvanceAmount: number;
  paymentDeadlineMinutes: number;
  remainingBalancePolicy: string;
  mandatoryForDelivery: boolean;
  mandatoryForPickup: boolean;
  useSeparateRulesByOrderType: boolean;
  pickupAdvanceType: 'percentage' | 'fixed';
  pickupAdvancePercentage: number;
  pickupFixedAdvanceAmount: number;
  requireAdvanceForQuotation: boolean;
  verificationPhone: string;
  verificationWhatsapp: string;
  updatedAt?: string;
}

export interface OrderPaymentRecord {
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  fulfilmentType: 'delivery' | 'pickup' | 'dine_in';
  totalOrderAmount: number;
  advanceRequired: boolean;
  requiredAdvanceAmount: number;
  submittedAmount: number;
  verifiedAdvanceAmount: number;
  remainingBalanceAmount: number;
  paymentStatus: OrderPaymentStatus;
  latestSubmissionId?: string;
  latestUtrNumber?: string;
  latestScreenshotUrl?: string;
  latestSubmittedAt?: string;
  rejectionReason?: string;
  internalAdminNote?: string;
  verifiedByEmail?: string;
  verifiedAt?: string;
  paymentDeadlineIso?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSubmissionRecord {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  fulfilmentType: 'delivery' | 'pickup' | 'dine_in';
  totalOrderAmount: number;
  requiredAdvanceAmount: number;
  amountPaid: number;
  utrNumber: string;
  screenshotUrl: string;
  screenshotMimeType: string;
  paymentDateTime: string;
  customerNote?: string;
  verificationStatus:
    | 'SUBMITTED'
    | 'AWAITING_VERIFICATION'
    | 'VERIFIED'
    | 'REJECTED'
    | 'RESUBMISSION_REQUESTED'
    | 'REFUNDED';
  rejectionReason?: string;
  adminNote?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface PaymentVerificationHistoryRecord {
  id: string;
  orderNumber: string;
  submissionId?: string;
  action:
    | 'ORDER_CREATED_AWAITING_ADVANCE'
    | 'CUSTOMER_CONTACT_PENDING'
    | 'PAYMENT_SUBMITTED'
    | 'PAYMENT_RESUBMITTED'
    | 'PAYMENT_VERIFIED'
    | 'PAYMENT_REJECTED'
    | 'RESUBMISSION_REQUESTED'
    | 'PAYMENT_REFUNDED'
    | 'INTERNAL_NOTE_ADDED';
  actorRole: 'customer' | 'admin' | 'system';
  actorIdentifier: string;
  amount?: number;
  utrNumber?: string;
  note: string;
  createdAt: string;
}

export const INITIAL_PAYMENT_SETTINGS: PaymentSettings = {
  upiId: 'loveysbakery@pnb',
  payeeDisplayName: "Lovey's Bakery & Pizza Corners",
  qrCodeImageUrl: '',
  paymentInstructions:
    '1. Pay the required advance amount using the official UPI ID or owner-uploaded QR code shown on this screen.\n2. Copy the 12-digit UPI Reference Number / UTR from your UPI app (GPay, PhonePe, Paytm, or BHIM) and take a screenshot of the completed transaction.\n3. Click "ALREADY PAID" below to upload your payment screenshot and UTR for fast manual verification by our Renukoot bakery counter.',
  advanceType: 'percentage',
  advancePercentage: 20,
  fixedAdvanceAmount: 200,
  minAdvanceAmount: 100,
  maxAdvanceAmount: 10000,
  paymentDeadlineMinutes: 60,
  remainingBalancePolicy:
    'The remaining balance after advance payment verification is payable via Cash or UPI at the time of doorstep delivery in Renukoot or at our store counter during takeaway parcel pickup.',
  mandatoryForDelivery: true,
  mandatoryForPickup: true,
  useSeparateRulesByOrderType: false,
  pickupAdvanceType: 'percentage',
  pickupAdvancePercentage: 20,
  pickupFixedAdvanceAmount: 150,
  requireAdvanceForQuotation: false,
  verificationPhone: '+91 80905 29971',
  verificationWhatsapp: '918090529971',
};

// ============================================================================
// LOVEY'S COMPLETE BUSINESS MANAGEMENT SYSTEM (BMS) TYPES & INITIAL CONFIGS
// ============================================================================

export type BmsPermissionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'publish'
  | 'delete_archive'
  | 'export_csv'
  | 'approve_orders'
  | 'verify_payments'
  | 'manage_settings'
  | 'invite_staff';

export interface RoleDefinitionRecord {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  permissionsSummary: string; // comma-separated BmsPermissionKey values
  updatedAt: string;
}

export interface StaffMemberRecord {
  id: string;
  email: string;
  username?: string;
  name: string;
  phone?: string;
  roleId: string;
  roleName: string;
  permissionsSummary: string;
  status: 'active' | 'invited' | 'suspended' | 'revoked';
  requirePasswordChange?: boolean;
  mustChangePassword?: boolean;
  sessionVersion?: number;
  sessionTimeoutMinutes?: number;
  lastLoginAt?: string;
  passwordUpdatedAt?: string;
  invitedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLogRecord {
  id: string;
  entityType: 'product' | 'variant' | 'ingredient';
  entityId: string;
  entityName: string;
  variantLabel?: string;
  changeType:
    | 'restock'
    | 'purchase'
    | 'sale_deduction'
    | 'order_cancel_restore'
    | 'wastage'
    | 'damaged'
    | 'manual_adjustment';
  previousStock: number;
  delta: number;
  newStock: number;
  reason: string;
  actorEmail: string;
  createdAt: string;
}

export interface RawMaterialRecord {
  id: string;
  name: string;
  category?: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  costPerUnit?: number;
  supplierName?: string;
  recipeNotes?: string;
  updatedAt: string;
}

export interface CustomerCrmNoteRecord {
  id: string;
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  savedAddresses?: string;
  tagsSummary?: string;
  segment?: string;
  preferredFulfilment?: string;
  whatsappOptIn?: boolean;
  phoneCallOptIn?: boolean;
  internalNotes?: string;
  supportHistorySummary?: string;
  privacyRequestStatus?: string;
  updatedByEmail?: string;
  updatedAt: string;
}

export interface WebsiteConfigRecord {
  id: string;
  heroHeading: string;
  heroHeadingHi?: string;
  heroSubparagraph: string;
  heroImageUrl?: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  promoBannerTitle?: string;
  promoBannerSubtitle?: string;
  promoBannerActive?: boolean;
  sectionsOrderSummary?: string; // e.g. "hero:true|categories:true|bestsellers:true|custom_cake:true|gallery:true|story:true|contact:true"
  navigationLinksJson?: string;
  footerDescription?: string;
  footerCopyright?: string;
  footerLinksJson?: string;
  seoDefaultTitle?: string;
  seoDefaultDescription?: string;
  seoKeywords?: string;
  ogImageUrl?: string;
  themePalettePreset?: string;
  themeTypographyPreset?: string;
  themeButtonStyle?: string;
  status: 'draft' | 'published';
  updatedByEmail?: string;
  updatedAt: string;
}

export interface CustomPageRecord {
  id: string;
  slug: string;
  title: string;
  titleHi?: string;
  subtitle?: string;
  subtitleHi?: string;
  content: string;
  contentHi?: string;
  heroImageUrl?: string;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  isPublished: boolean;
  updatedByEmail?: string;
  updatedAt: string;
}

export interface AdminNotificationRecord {
  id: string;
  category:
    | 'order'
    | 'payment'
    | 'inventory'
    | 'custom_cake'
    | 'crm'
    | 'website'
    | 'security';
  title: string;
  message: string;
  targetRoute?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  outcome: 'success' | 'failure' | 'warning';
  createdAt: string;
}

export interface BackupRecordItem {
  id: string;
  label: string;
  collectionsIncluded: string;
  totalDocumentsCount: number;
  sizeBytes: number;
  checksumSha256?: string;
  createdByEmail: string;
  status: 'verified' | 'restored';
  createdAt: string;
}

export const INITIAL_ROLE_DEFINITIONS: RoleDefinitionRecord[] = [
  {
    id: 'role-owner',
    name: 'Owner / Super Admin',
    description:
      'Full control over all business operations, financial records, payment verification, staff invitations, security controls, and backups.',
    isSystemRole: true,
    permissionsSummary:
      'view,create,edit,publish,delete_archive,export_csv,approve_orders,verify_payments,manage_settings,invite_staff',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'role-manager',
    name: 'Store Manager',
    description:
      'Operational access to orders, inventory, products, cake designs, payment verification, and customer support.',
    isSystemRole: true,
    permissionsSummary:
      'view,create,edit,publish,export_csv,approve_orders,verify_payments',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'role-order-manager',
    name: 'Order & Kitchen Manager',
    description:
      'Access strictly to order management, kitchen preparation status, delivery/pickup slots, and table QR service.',
    isSystemRole: true,
    permissionsSummary: 'view,edit,approve_orders',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'role-content-manager',
    name: 'Content & Catalogue Manager',
    description:
      'Access to products, categories, custom cake designs, gallery media library, homepage editor, and public website pages.',
    isSystemRole: true,
    permissionsSummary: 'view,create,edit,publish',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
];

export const INITIAL_STAFF_MEMBERS: StaffMemberRecord[] = [
  {
    id: 'staff-owner-default',
    email: 'owner@loveys-demo.test',
    username: 'owner',
    name: "Lovey's Principal Owner",
    phone: '+91 80905 29971',
    roleId: 'role-owner',
    roleName: 'Owner / Super Admin',
    permissionsSummary:
      'view,create,edit,publish,delete_archive,export_csv,approve_orders,verify_payments,manage_settings,invite_staff',
    status: 'active',
    requirePasswordChange: true,
    mustChangePassword: true,
    sessionVersion: 1,
    sessionTimeoutMinutes: 60,
    passwordUpdatedAt: '2026-11-20T00:00:00.000Z',
    invitedByEmail: 'system',
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
];

export const INITIAL_WEBSITE_CONFIG: WebsiteConfigRecord = {
  id: 'default',
  heroHeading: 'Artisan Celebration Cakes & Stone-Baked Pizzas in Renukoot',
  heroHeadingHi: 'रेणुकूट में ताज़ा बेक किए गए सेलिब्रेशन केक और स्टोन-बेक्ड पिज़्ज़ा',
  heroSubparagraph:
    "Welcome to Lovey's Bakery & Pizza Corners (in front of Tiwari Hotel, near Punjab National Bank, Renukoot). Order 100% eggless custom celebration cakes, rich Belgian chocolate truffle gateaux, stone-baked pizzas, and warm bakery treats.",
  heroImageUrl: GENERATED_IMAGES.heroBakery,
  primaryCtaText: 'Order Online from Menu',
  primaryCtaLink: '/menu',
  secondaryCtaText: 'Custom Cake Studio',
  secondaryCtaLink: '/custom-cake',
  promoBannerTitle: 'Free Home Delivery in Renukoot on Orders Above ₹799',
  promoBannerSubtitle:
    'Use code LOVEYS10 for 10% off celebration cakes or CELEBRATE150 on party orders.',
  promoBannerActive: true,
  sectionsOrderSummary:
    'hero:true|categories:true|bestsellers:true|custom_cake:true|gallery:true|story:true|contact:true',
  navigationLinksJson: JSON.stringify([
    { label: 'Home', labelHi: 'होम', path: '/', isVisible: true },
    { label: 'Explore Menu', labelHi: 'मेनू', path: '/menu', isVisible: true },
    { label: 'Cakes', labelHi: 'केक', path: '/cakes', isVisible: true },
    { label: 'Gallery', labelHi: 'गैलरी', path: '/gallery', isVisible: true },
    { label: 'Our Story', labelHi: 'हमारी कहानी', path: '/about', isVisible: true },
    { label: 'Contact', labelHi: 'संपर्क', path: '/contact', isVisible: true },
  ]),
  footerDescription:
    "Freshly baked 100% eggless celebration cakes, bespoke custom cakes, stone-baked pizzas, Belgian waffles, and evening bakery snacks in Renukoot, Sonbhadra.",
  footerCopyright:
    "Lovey's Bakery & Pizza Corners (लवी'स बेकरी & पिज्जा कॉर्नर्स), Renukoot, Sonbhadra, UP 231217. All rights reserved.",
  footerLinksJson: JSON.stringify([
    { label: 'Delivery & PIN Zones Policy', path: '/delivery-policy' },
    { label: 'Cancellation & Refund Policy', path: '/cancellation-policy' },
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Terms of Service', path: '/terms' },
  ]),
  seoDefaultTitle:
    "Lovey's Bakery & Pizza Corners | Custom Cakes, Bakery & Pizza in Renukoot",
  seoDefaultDescription:
    "Order custom celebration cakes, chocolate truffle cakes, stone-baked pizzas, waffles, and bakery snacks online from Lovey's Bakery & Pizza Corners, Renukoot, Sonbhadra.",
  seoKeywords:
    'Loveys Bakery Renukoot, Custom Cake Renukoot, Pizza Corner Renukoot, Bakery near Tiwari Hotel PNB Renukoot, Sonbhadra Bakery',
  ogImageUrl: GENERATED_IMAGES.heroBakery,
  themePalettePreset: 'warm-ivory-cocoa-berry',
  themeTypographyPreset: 'cormorant-plus-jakarta',
  themeButtonStyle: 'rounded-2xl',
  status: 'published',
  updatedByEmail: 'prabhve5@gmail.com',
  updatedAt: '2026-11-20T00:00:00.000Z',
};

export const INITIAL_CUSTOM_PAGES: CustomPageRecord[] = [
  {
    id: 'page-about',
    slug: 'about',
    title: "Our Story — Lovey's Bakery & Pizza Corners",
    titleHi: "हमारी कहानी — लवी'स बेकरी & पिज्जा कॉर्नर्स, रेणुकूट",
    subtitle: 'Handcrafted Celebration Cakes, Artisan Bakery & Stone-Baked Pizzas in Renukoot',
    subtitleHi: 'रेणुकूट में ताज़ा बेक किए गए सेलिब्रेशन केक, बेकरी और पिज़्ज़ा',
    content: INITIAL_BUSINESS_SETTINGS.ourStoryContent,
    heroImageUrl: GENERATED_IMAGES.storeTable,
    imageAlt: "Bakery table and cake creations at Lovey's Bakery & Pizza Corners, Renukoot",
    seoTitle: "Our Story | Lovey's Bakery & Pizza Corners Renukoot",
    seoDescription:
      "Learn about Lovey's Bakery & Pizza Corners in front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra.",
    isPublished: true,
    updatedByEmail: 'prabhve5@gmail.com',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'page-delivery-policy',
    slug: 'delivery-policy',
    title: 'Delivery, Takeaway & PIN Code Serviceability Policy',
    titleHi: 'होम डिलीवरी, टेकअवे और पिन कोड सेवा नीति',
    subtitle: 'Transparent Local Fulfilment Across Renukoot & Sonbhadra',
    content:
      "1. Serviceable Localities: We provide doorstep delivery across Renukoot Main Market, Tiwari Hotel Road, PNB Road, Hindalco Colony, Murdhawa, and nearby serviceable PIN codes configured in our Fulfilment console.\n\n2. Advance Payment Verification: Home Delivery and Takeaway/Parcel orders require the configured UPI advance payment and UTR/screenshot verification before kitchen preparation starts.\n\n3. Cold-Chain Cake Care: Celebration cakes are transported in insulated bakery boxes. Please refrigerate cream and truffle cakes immediately upon delivery.",
    seoTitle: "Home Delivery & Takeaway Policy in Renukoot | Lovey's Bakery",
    seoDescription:
      "Check serviceable PIN codes, delivery fees, takeaway parcel pickup rules, and cake transport care for Lovey's Bakery & Pizza Corners in Renukoot.",
    isPublished: true,
    updatedByEmail: 'prabhve5@gmail.com',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'page-cancellation-policy',
    slug: 'cancellation-policy',
    title: 'Cancellation, Refund & Custom Cake Policy',
    titleHi: 'ऑर्डर कैंसिलेशन, रिफंड और कस्टम केक नीति',
    subtitle: 'Fair & Transparent Policies for Freshly Prepared Bakery Orders',
    content:
      "1. Standard Menu Orders: Cancellations requested before kitchen preparation starts are eligible for full advance refund or rescheduling.\n\n2. Custom Celebration Cakes: Because bespoke cakes are freshly baked and decorated to your specific weight, flavour, and inscription, cancellation requests must be made at least 12 hours prior to the scheduled pickup/delivery slot.\n\n3. Quality Commitment: If there is ever an issue with your order, contact us immediately at +91 80905 29971 or via WhatsApp with your Order Number.",
    seoTitle: "Cancellation & Custom Cake Policy | Lovey's Bakery Renukoot",
    seoDescription:
      "Review the order cancellation, custom cake advance notice, and refund policy for Lovey's Bakery & Pizza Corners in Renukoot.",
    isPublished: true,
    updatedByEmail: 'prabhve5@gmail.com',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'page-privacy-policy',
    slug: 'privacy-policy',
    title: 'Customer Privacy & Data Protection Policy',
    titleHi: 'ग्राहक गोपनीयता और डेटा सुरक्षा नीति',
    subtitle: 'How We Protect Your Order & Contact Information',
    content:
      "1. Data Collection: We collect only your name, phone/WhatsApp number, delivery address (for delivery orders), and UPI transaction reference/screenshot solely to fulfil and verify your bakery orders.\n\n2. Strict Access Control: Customer contact details and payment verification screenshots are stored privately and restricted strictly to authorised bakery administrators.\n\n3. Customer Rights: You may request address correction, order history access, or account data deletion at any time by contacting Lovey's Bakery & Pizza Corners.",
    seoTitle: "Privacy Policy | Lovey's Bakery & Pizza Corners Renukoot",
    seoDescription:
      "Read how Lovey's Bakery & Pizza Corners protects customer contact details, order records, and UPI advance payment verification data.",
    isPublished: true,
    updatedByEmail: 'prabhve5@gmail.com',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'page-terms',
    slug: 'terms',
    title: 'Terms & Conditions of Service',
    titleHi: 'सेवा की शर्तें और नियम',
    subtitle: "Ordering & Website Terms for Lovey's Bakery & Pizza Corners",
    content:
      "1. Pricing & Taxes: All menu prices are listed in Indian Rupees (INR). Applicable GST, packaging charges, and locality delivery fees are transparently calculated at checkout.\n\n2. Manual UPI Advance Verification: Submitting a screenshot or UTR number places your order in 'Submitted for Verification' status. Kitchen confirmation occurs once our team verifies receipt in our merchant account.\n\n3. Contact: In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, UP 231217 · Tel: +91 80905 29971.",
    seoTitle: "Terms of Service | Lovey's Bakery & Pizza Corners Renukoot",
    seoDescription:
      "Terms and conditions for online cake, bakery, and pizza ordering at Lovey's Bakery & Pizza Corners, Renukoot, Sonbhadra.",
    isPublished: true,
    updatedByEmail: 'prabhve5@gmail.com',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'page-cake-ordering-guide',
    slug: 'cake-ordering-guide',
    title: 'Custom Birthday & Celebration Cake Ordering Guide in Renukoot',
    titleHi: 'रेणुकूट में कस्टम बर्थडे और सेलिब्रेशन केक ऑर्डर करने की गाइड',
    subtitle: 'How to Choose Cake Weight, Flavour, Design Reference & Advance Booking Time',
    content:
      "1. Selecting the Right Cake Weight for Your Gathering:\n• 500g (0.5 kg): Ideal for 4 to 6 guests.\n• 1.0 kg: Ideal for 10 to 12 guests.\n• 1.5 kg to 2.0 kg: Suitable for 15 to 25 guests or single/two-tier birthday celebrations.\n• 3.0 kg+ Multi-Tier Cakes: Recommended for milestone anniversaries, weddings, and large family events in Renukoot.\n\n2. Submitting a Reference Photograph or Custom Theme:\nIn our Custom Cake Studio (/custom-cake), you can choose weight, sponge flavour, filling, frosting, and personalized cake inscription, and upload a reference cake photo (JPG, PNG, or WebP up to 5 MB). For complex multi-tier or sculpted designs, enable the Bespoke Chef Quotation toggle so our kitchen can confirm exact pricing before advance payment.\n\n3. Recommended Advance Notice:\nStandard celebration cakes should be ordered at least 4 to 6 hours in advance. Two-tier and custom theme cakes should be booked at least 12 to 24 hours in advance.\n\n4. UPI Advance Payment & Order Confirmation:\nFor Home Delivery and Takeaway Parcel orders, pay the required advance via our official UPI QR/ID and submit your 12-digit UTR and screenshot. Once verified by our counter in front of Tiwari Hotel near Punjab National Bank, your order enters fresh kitchen preparation.",
    heroImageUrl: GENERATED_IMAGES.customCake,
    imageAlt: "Custom two-tier celebration cake guide at Lovey's Bakery & Pizza Corners, Renukoot",
    seoTitle: "Custom Cake Ordering & Weight Guide in Renukoot | Lovey's Bakery",
    seoDescription:
      "Complete guide to choosing cake weight, custom flavours, uploading reference cake photos, and UPI advance confirmation at Lovey's Bakery in Renukoot.",
    isPublished: true,
    updatedByEmail: 'prabhve5@gmail.com',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
];

export const INITIAL_RAW_MATERIALS: RawMaterialRecord[] = [
  {
    id: 'rm-belgian-couverture',
    name: 'Belgian 54% Dark Chocolate Couverture',
    category: 'Chocolate & Cocoa',
    unit: 'kg',
    currentStock: 18.5,
    minThreshold: 6,
    costPerUnit: 820,
    supplierName: 'Callebaut India / Varanasi Bakery Distributors',
    recipeNotes: 'Primary ganache and sponge base for Signature Belgian Chocolate Truffle Gateau.',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'rm-whipping-cream',
    name: 'Rich Non-Dairy & Dairy Whipping Cream Blend',
    category: 'Dairy & Cream',
    unit: 'L',
    currentStock: 24,
    minThreshold: 10,
    costPerUnit: 210,
    supplierName: 'Renukoot Cold Chain Dairy Supply',
    recipeNotes: 'Chilled at 2–4°C for celebration cake frosting and pastry layering.',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'rm-mozzarella-cheese',
    name: 'Artisan Shredded Mozzarella & Cheddar Blend',
    category: 'Pizza Kitchen',
    unit: 'kg',
    currentStock: 14,
    minThreshold: 5,
    costPerUnit: 460,
    supplierName: 'Amul Commercial Foodservice',
    recipeNotes: 'Used across all stone-baked pizzas and stuffed garlic breads.',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
  {
    id: 'rm-cake-boxes',
    name: 'Insulated Gold-Foiled 1 kg Cake Boxes & Base Boards',
    category: 'Packaging',
    unit: 'pcs',
    currentStock: 85,
    minThreshold: 25,
    costPerUnit: 32,
    supplierName: 'Sonbhadra Packaging Works',
    recipeNotes: 'Food-grade corrugated celebration boxes for home delivery and takeaway.',
    updatedAt: '2026-11-20T00:00:00.000Z',
  },
];



