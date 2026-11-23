import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  db,
  auth,
  googleProvider,
  OperationType,
  handleFirestoreError,
} from './lib/firebase';
import {
  INITIAL_BUSINESS_SETTINGS,
  INITIAL_PAYMENT_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_CAKE_DESIGNS,
  INITIAL_MEDIA_ASSETS,
  INITIAL_COUPONS,
  INITIAL_DELIVERY_ZONES,
  INITIAL_DINING_TABLES,
  INITIAL_ROLE_DEFINITIONS,
  INITIAL_STAFF_MEMBERS,
  INITIAL_RAW_MATERIALS,
  INITIAL_WEBSITE_CONFIG,
  INITIAL_CUSTOM_PAGES,
  BusinessSettings,
  PaymentSettings,
  OrderPaymentRecord,
  PaymentSubmissionRecord,
  PaymentVerificationHistoryRecord,
  CategoryItem,
  ProductItem,
  CakeDesignItem,
  MediaAssetItem,
  CouponItem,
  DeliveryZoneItem,
  DiningTableItem,
  StaffMemberRecord,
  RoleDefinitionRecord,
  InventoryLogRecord,
  RawMaterialRecord,
  CustomerCrmNoteRecord,
  WebsiteConfigRecord,
  CustomPageRecord,
  AdminNotificationRecord,
  AuditLogRecord,
  BackupRecordItem,
  parseVariantOptions,
  parseAddonOptions,
} from './data/initialCatalogue';
import { StoreMapSection } from './components/StoreMapSection';
import { AdminDashboard, OrderRecord } from './components/AdminDashboard';
import { AdvancePaymentView } from './components/AdvancePaymentView';
import {
  ShoppingBag,
  Search,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Cake,
  QrCode,
  ShieldCheck,
  Truck,
  Store,
  Utensils,
  MessageCircle,
  Maximize2,
  Play,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';

const Scroll3DShowcase = React.lazy(() => import('./components/Scroll3DShowcase'));

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  nameHi?: string;
  slug: string;
  imageUrl: string;
  basePrice: number;
  selectedSizeLabel: string;
  selectedSizeDelta: number;
  selectedFlavorLabel?: string;
  selectedFlavorDelta: number;
  selectedFrostingLabel?: string;
  selectedFrostingDelta: number;
  selectedAddons: { label: string; price: number }[];
  cakeMessage?: string;
  specialInstructions?: string;
  isEggless: boolean;
  isCustomCake?: boolean;
  isQuotationBased?: boolean;
  customCakeMeta?: {
    occasion: string;
    weightKg: string;
    flavour: string;
    filling: string;
    frosting: string;
    inscription: string;
    deliveryDate: string;
    deliveryTimeSlot: string;
    referenceImageUrl?: string;
    designNotes?: string;
  };
  unitPrice: number;
  quantity: number;
}

const BOOTSTRAPPED_ADMIN_EMAIL = 'prabhve5@gmail.com';

export default function App() {
  // --------------------------------------------------------------------------
  // 1. GOOGLE MAPS PLATFORM — TIER 2 QUOTA ALERT BANNER
  // --------------------------------------------------------------------------
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // --------------------------------------------------------------------------
  // 2. SPA ROUTING & DINE-IN TABLE QR PARAMETER DETECTION
  // --------------------------------------------------------------------------
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [activeTableQr, setActiveTableQr] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || '';
  });

  const navigate = (path: string) => {
    const [pathname, search] = path.split('?');
    window.history.pushState({}, '', path);
    setCurrentPath(pathname || '/');
    if (search) {
      const params = new URLSearchParams(search);
      const tbl = params.get('table');
      if (tbl) {
        setActiveTableQr(tbl);
        setCheckoutFulfilment('dine_in');
        setCheckoutTableNumber(tbl);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      const params = new URLSearchParams(window.location.search);
      const tbl = params.get('table');
      if (tbl) {
        setActiveTableQr(tbl);
        setCheckoutFulfilment('dine_in');
        setCheckoutTableNumber(tbl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --------------------------------------------------------------------------
  // 3. LANGUAGE TOGGLE (EN / हिंदी), GALLERY LIGHTBOX & UI STATE
  // --------------------------------------------------------------------------
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lightboxAsset, setLightboxAsset] = useState<MediaAssetItem | null>(null);
  const [signatureCakeIdx, setSignatureCakeIdx] = useState(0);

  // --------------------------------------------------------------------------
  // 4. FIREBASE AUTHENTICATION & FIRESTORE REAL-TIME COLLECTIONS
  // --------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [passwordAuthEmail, setPasswordAuthEmail] = useState<string | null>(null);
  const isAdminUser = isFirebaseAdmin || Boolean(passwordAuthEmail);

  const [settings, setSettings] = useState<BusinessSettings>(INITIAL_BUSINESS_SETTINGS);
  const [paymentSettings, setPaymentSettings] =
    useState<PaymentSettings>(INITIAL_PAYMENT_SETTINGS);
  const [categories, setCategories] = useState<CategoryItem[]>(INITIAL_CATEGORIES);
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [cakeDesigns, setCakeDesigns] = useState<CakeDesignItem[]>(INITIAL_CAKE_DESIGNS);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>(INITIAL_MEDIA_ASSETS);
  const [coupons, setCoupons] = useState<CouponItem[]>(INITIAL_COUPONS);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZoneItem[]>(INITIAL_DELIVERY_ZONES);
  const [diningTables, setDiningTables] = useState<DiningTableItem[]>(INITIAL_DINING_TABLES);
  const [websiteConfig, setWebsiteConfig] = useState<WebsiteConfigRecord>(INITIAL_WEBSITE_CONFIG);
  const [customPages, setCustomPages] = useState<CustomPageRecord[]>(INITIAL_CUSTOM_PAGES);
  const [staffMembers, setStaffMembers] = useState<StaffMemberRecord[]>(INITIAL_STAFF_MEMBERS);
  const [roleDefinitions, setRoleDefinitions] =
    useState<RoleDefinitionRecord[]>(INITIAL_ROLE_DEFINITIONS);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogRecord[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>(INITIAL_RAW_MATERIALS);
  const [customerCrmNotes, setCustomerCrmNotes] = useState<CustomerCrmNoteRecord[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [backupRecords, setBackupRecords] = useState<BackupRecordItem[]>([]);
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([]);
  const [adminOrderPayments, setAdminOrderPayments] = useState<OrderPaymentRecord[]>([]);
  const [adminPaymentSubmissions, setAdminPaymentSubmissions] = useState<
    PaymentSubmissionRecord[]
  >([]);
  const [adminPaymentHistory, setAdminPaymentHistory] = useState<
    PaymentVerificationHistoryRecord[]
  >([]);

  // Auth listener & automatic initial catalogue seeding if admin logs in on empty DB
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) {
        setIsFirebaseAdmin(true);
        // Seed initial data into Firestore if business_settings/default doesn't exist yet
        try {
          const settingsSnap = await getDoc(doc(db, 'business_settings', 'default'));
          if (!settingsSnap.exists()) {
            const batch = writeBatch(db);
            batch.set(doc(db, 'business_settings', 'default'), INITIAL_BUSINESS_SETTINGS);
            batch.set(doc(db, 'payment_settings', 'default'), INITIAL_PAYMENT_SETTINGS);
            batch.set(doc(db, 'website_config', 'default'), INITIAL_WEBSITE_CONFIG);
            INITIAL_CATEGORIES.forEach((c) => batch.set(doc(db, 'categories', c.id), c));
            INITIAL_PRODUCTS.forEach((p) => batch.set(doc(db, 'products', p.id), p));
            INITIAL_CAKE_DESIGNS.forEach((cd) => batch.set(doc(db, 'cake_designs', cd.id), cd));
            INITIAL_MEDIA_ASSETS.forEach((m) => batch.set(doc(db, 'media_assets', m.id), m));
            INITIAL_COUPONS.forEach((cp) => batch.set(doc(db, 'coupons', cp.id), cp));
            INITIAL_DELIVERY_ZONES.forEach((dz) => batch.set(doc(db, 'delivery_zones', dz.id), dz));
            INITIAL_DINING_TABLES.forEach((dt) => batch.set(doc(db, 'dining_tables', dt.id), dt));
            INITIAL_CUSTOM_PAGES.forEach((pg) => batch.set(doc(db, 'custom_pages', pg.id), pg));
            INITIAL_ROLE_DEFINITIONS.forEach((rl) =>
              batch.set(doc(db, 'role_definitions', rl.id), rl)
            );
            INITIAL_STAFF_MEMBERS.forEach((st) =>
              batch.set(doc(db, 'staff_members', st.email), st)
            );
            INITIAL_RAW_MATERIALS.forEach((rm) =>
              batch.set(doc(db, 'raw_materials', rm.id), rm)
            );
            await batch.commit();
          } else {
            const paySnap = await getDoc(doc(db, 'payment_settings', 'default'));
            if (!paySnap.exists()) {
              const batch = writeBatch(db);
              batch.set(doc(db, 'payment_settings', 'default'), INITIAL_PAYMENT_SETTINGS);
              await batch.commit();
            }
            const webSnap = await getDoc(doc(db, 'website_config', 'default'));
            if (!webSnap.exists()) {
              const batch = writeBatch(db);
              batch.set(doc(db, 'website_config', 'default'), INITIAL_WEBSITE_CONFIG);
              INITIAL_CUSTOM_PAGES.forEach((pg) => batch.set(doc(db, 'custom_pages', pg.id), pg));
              INITIAL_ROLE_DEFINITIONS.forEach((rl) =>
                batch.set(doc(db, 'role_definitions', rl.id), rl)
              );
              INITIAL_STAFF_MEMBERS.forEach((st) =>
                batch.set(doc(db, 'staff_members', st.email), st)
              );
              INITIAL_RAW_MATERIALS.forEach((rm) =>
                batch.set(doc(db, 'raw_materials', rm.id), rm)
              );
              await batch.commit();
            }
          }
        } catch (err) {
          console.warn('Initial seed check:', err);
        }
      } else {
        setIsFirebaseAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Real-time public listeners with safe error callbacks
  useEffect(() => {
    const onListenerError = (collectionName: string) => (err: Error) => {
      console.warn(`Firestore listener fallback active for ${collectionName}:`, err.message);
    };

    const unsubSettings = onSnapshot(
      doc(db, 'business_settings', 'default'),
      (snap) => {
        if (snap.exists()) setSettings(snap.data() as BusinessSettings);
      },
      onListenerError('business_settings')
    );
    const unsubPaySettings = onSnapshot(
      doc(db, 'payment_settings', 'default'),
      (snap) => {
        if (snap.exists()) setPaymentSettings(snap.data() as PaymentSettings);
      },
      onListenerError('payment_settings')
    );
    const unsubWebConfig = onSnapshot(
      doc(db, 'website_config', 'default'),
      (snap) => {
        if (snap.exists()) setWebsiteConfig(snap.data() as WebsiteConfigRecord);
      },
      onListenerError('website_config')
    );
    const unsubCustomPages = onSnapshot(
      collection(db, 'custom_pages'),
      (snap) => {
        if (!snap.empty) {
          setCustomPages(snap.docs.map((d) => d.data() as CustomPageRecord));
        }
      },
      onListenerError('custom_pages')
    );
    const unsubCats = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as CategoryItem);
          list.sort((a, b) => (a.displayOrder ?? a.sortOrder ?? 0) - (b.displayOrder ?? b.sortOrder ?? 0));
          setCategories(list);
        }
      },
      onListenerError('categories')
    );
    const unsubProds = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!snap.empty) {
          setProducts(snap.docs.map((d) => d.data() as ProductItem));
        }
      },
      onListenerError('products')
    );
    const unsubCakes = onSnapshot(
      collection(db, 'cake_designs'),
      (snap) => {
        if (!snap.empty) {
          setCakeDesigns(snap.docs.map((d) => d.data() as CakeDesignItem));
        }
      },
      onListenerError('cake_designs')
    );
    const unsubMedia = onSnapshot(
      collection(db, 'media_assets'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as MediaAssetItem);
          list.sort((a, b) => (a.displayOrder ?? a.sortOrder ?? 0) - (b.displayOrder ?? b.sortOrder ?? 0));
          setMediaAssets(list);
        }
      },
      onListenerError('media_assets')
    );
    const unsubCoupons = onSnapshot(
      collection(db, 'coupons'),
      (snap) => {
        if (!snap.empty) {
          setCoupons(snap.docs.map((d) => d.data() as CouponItem));
        }
      },
      onListenerError('coupons')
    );
    const unsubZones = onSnapshot(
      collection(db, 'delivery_zones'),
      (snap) => {
        if (!snap.empty) {
          setDeliveryZones(snap.docs.map((d) => d.data() as DeliveryZoneItem));
        }
      },
      onListenerError('delivery_zones')
    );
    const unsubTables = onSnapshot(
      collection(db, 'dining_tables'),
      (snap) => {
        if (!snap.empty) {
          setDiningTables(snap.docs.map((d) => d.data() as DiningTableItem));
        }
      },
      onListenerError('dining_tables')
    );

    return () => {
      unsubSettings();
      unsubPaySettings();
      unsubWebConfig();
      unsubCustomPages();
      unsubCats();
      unsubProds();
      unsubCakes();
      unsubMedia();
      unsubCoupons();
      unsubZones();
      unsubTables();
    };
  }, []);

  // Admin orders, payment verification & BMS listeners (when Firebase admin is authenticated)
  useEffect(() => {
    if (!isFirebaseAdmin) {
      return;
    }
    const safeWarn = (name: string) => (err: Error) => {
      console.warn(`Admin Firestore listener (${name}):`, err.message);
    };

    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        setAdminOrders(snap.docs.map((d) => d.data() as OrderRecord));
      },
      safeWarn('orders')
    );

    const qPayments = query(collection(db, 'order_payments'), orderBy('createdAt', 'desc'));
    const unsubPayments = onSnapshot(
      qPayments,
      (snap) => {
        setAdminOrderPayments(snap.docs.map((d) => d.data() as OrderPaymentRecord));
      },
      safeWarn('order_payments')
    );

    const qSubs = query(collection(db, 'payment_submissions'), orderBy('createdAt', 'desc'));
    const unsubSubs = onSnapshot(
      qSubs,
      (snap) => {
        setAdminPaymentSubmissions(snap.docs.map((d) => d.data() as PaymentSubmissionRecord));
      },
      safeWarn('payment_submissions')
    );

    const qHist = query(
      collection(db, 'payment_verification_history'),
      orderBy('createdAt', 'desc')
    );
    const unsubHist = onSnapshot(
      qHist,
      (snap) => {
        setAdminPaymentHistory(
          snap.docs.map((d) => d.data() as PaymentVerificationHistoryRecord)
        );
      },
      safeWarn('payment_verification_history')
    );

    const unsubStaff = onSnapshot(
      collection(db, 'staff_members'),
      (snap) => {
        if (!snap.empty) {
          setStaffMembers(snap.docs.map((d) => d.data() as StaffMemberRecord));
        }
      },
      safeWarn('staff_members')
    );

    const unsubRoles = onSnapshot(
      collection(db, 'role_definitions'),
      (snap) => {
        if (!snap.empty) {
          setRoleDefinitions(snap.docs.map((d) => d.data() as RoleDefinitionRecord));
        }
      },
      safeWarn('role_definitions')
    );

    const unsubInvLogs = onSnapshot(
      query(collection(db, 'inventory_logs'), orderBy('createdAt', 'desc')),
      (snap) => {
        setInventoryLogs(snap.docs.map((d) => d.data() as InventoryLogRecord));
      },
      safeWarn('inventory_logs')
    );

    const unsubRawMats = onSnapshot(
      collection(db, 'raw_materials'),
      (snap) => {
        if (!snap.empty) {
          setRawMaterials(snap.docs.map((d) => d.data() as RawMaterialRecord));
        }
      },
      safeWarn('raw_materials')
    );

    const unsubCrmNotes = onSnapshot(
      collection(db, 'customer_crm_notes'),
      (snap) => {
        setCustomerCrmNotes(snap.docs.map((d) => d.data() as CustomerCrmNoteRecord));
      },
      safeWarn('customer_crm_notes')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'admin_notifications'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAdminNotifications(snap.docs.map((d) => d.data() as AdminNotificationRecord));
      },
      safeWarn('admin_notifications')
    );

    const unsubAudits = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAuditLogs(snap.docs.map((d) => d.data() as AuditLogRecord));
      },
      safeWarn('audit_logs')
    );

    const unsubBackups = onSnapshot(
      query(collection(db, 'backup_records'), orderBy('createdAt', 'desc')),
      (snap) => {
        setBackupRecords(snap.docs.map((d) => d.data() as BackupRecordItem));
      },
      safeWarn('backup_records')
    );

    return () => {
      unsubOrders();
      unsubPayments();
      unsubSubs();
      unsubHist();
      unsubStaff();
      unsubRoles();
      unsubInvLogs();
      unsubRawMats();
      unsubCrmNotes();
      unsubNotifs();
      unsubAudits();
      unsubBackups();
    };
  }, [isFirebaseAdmin]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  const handleGoogleSignOut = async () => {
    setPasswordAuthEmail(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  // --------------------------------------------------------------------------
  // 5. CART STATE (PERSISTED IN LOCALSTORAGE WITH MULTI-DIMENSIONAL VARIANTS)
  // --------------------------------------------------------------------------
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('loveys_cart_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cartFeedbackBanner, setCartFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('loveys_cart_v2', JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  const addToCart = (newItem: CartItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.productId === newItem.productId &&
          item.selectedSizeLabel === newItem.selectedSizeLabel &&
          item.selectedFlavorLabel === newItem.selectedFlavorLabel &&
          item.selectedFrostingLabel === newItem.selectedFrostingLabel &&
          (item.cakeMessage || '') === (newItem.cakeMessage || '') &&
          !newItem.isCustomCake
      );
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += newItem.quantity;
        return copy;
      }
      return [...prev, newItem];
    });
    setCartFeedbackBanner(`Added "${newItem.name}" (${newItem.selectedSizeLabel}) to your cart!`);
    setTimeout(() => setCartFeedbackBanner(null), 3500);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  // --------------------------------------------------------------------------
  // 6. MENU FILTERING & MULTI-DIMENSIONAL PDP VARIANT SELECTION STATE
  // --------------------------------------------------------------------------
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [filterEgglessOnly, setFilterEgglessOnly] = useState(false);
  const [filterSameDayOnly, setFilterSameDayOnly] = useState(false);
  const [menuSortBy, setMenuSortBy] = useState<'popular' | 'price_asc' | 'price_desc'>('popular');

  // Product Detail Page (PDP) Selection State
  const [pdpSizeIdx, setPdpSizeIdx] = useState(0);
  const [pdpFlavorIdx, setPdpFlavorIdx] = useState(0);
  const [pdpFrostingIdx, setPdpFrostingIdx] = useState(0);
  const [pdpSelectedAddons, setPdpSelectedAddons] = useState<string[]>([]);
  const [pdpCakeMessage, setPdpCakeMessage] = useState('');
  const [pdpSpecialNote, setPdpSpecialNote] = useState('');
  const [pdpQuantity, setPdpQuantity] = useState(1);

  // Reset PDP variant indices when navigating to a new product slug
  useEffect(() => {
    setPdpSizeIdx(0);
    setPdpFlavorIdx(0);
    setPdpFrostingIdx(0);
    setPdpSelectedAddons([]);
    setPdpCakeMessage('');
    setPdpSpecialNote('');
    setPdpQuantity(1);
  }, [currentPath]);

  // --------------------------------------------------------------------------
  // 7. CUSTOM CAKE STUDIO STATE (/custom-cake)
  // --------------------------------------------------------------------------
  const [customOccasion, setCustomOccasion] = useState('Birthday Celebration');
  const [customWeightKg, setCustomWeightKg] = useState('1.5 kg (Serves 15–18)');
  const [customWeightMultiplier, setCustomWeightMultiplier] = useState(1.5);
  const [customFlavour, setCustomFlavour] = useState('Belgian Dark Chocolate Truffle (+₹0)');
  const [customFlavourDelta, setCustomFlavourDelta] = useState(0);
  const [customFilling, setCustomFilling] = useState('Roasted Hazelnut Praline Crunch (+₹140)');
  const [customFillingDelta, setCustomFillingDelta] = useState(140);
  const [customFrosting, setCustomFrosting] = useState('Silky Dark Chocolate Ganache (+₹100)');
  const [customFrostingDelta, setCustomFrostingDelta] = useState(100);
  const [customEggless, setCustomEggless] = useState(true);
  const [customInscription, setCustomInscription] = useState('Happy Birthday Aarav!');
  const [customDate, setCustomDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [customTimeSlot, setCustomTimeSlot] = useState('5:00 PM – 7:00 PM');
  const [customRefImageUrl, setCustomRefImageUrl] = useState('');
  const [customDesignNotes, setCustomDesignNotes] = useState('');
  const [customIsQuotation, setCustomIsQuotation] = useState(false);

  const computedCustomCakePrice = Math.round(
    900 * customWeightMultiplier + customFlavourDelta + customFillingDelta + customFrostingDelta
  );

  const handleAddCustomCakeToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const customItem: CartItem = {
      cartItemId: `custom-${Date.now()}`,
      productId: 'custom-cake-studio',
      name: `Bespoke ${customOccasion} Cake (${customWeightKg})`,
      nameHi: `कस्टम सेलिब्रेशन केक (${customWeightKg})`,
      slug: 'custom-cake',
      imageUrl:
        customRefImageUrl || '/assets/cakes/loveys-tier-celebration-cake.jpg',
      basePrice: computedCustomCakePrice,
      selectedSizeLabel: customWeightKg,
      selectedSizeDelta: 0,
      selectedFlavorLabel: customFlavour,
      selectedFlavorDelta: customFlavourDelta,
      selectedFrostingLabel: customFrosting,
      selectedFrostingDelta: customFrostingDelta,
      selectedAddons: [],
      cakeMessage: customInscription, // Preserved verbatim!
      specialInstructions: customDesignNotes,
      isEggless: customEggless,
      isCustomCake: true,
      isQuotationBased: customIsQuotation,
      customCakeMeta: {
        occasion: customOccasion,
        weightKg: customWeightKg,
        flavour: customFlavour,
        filling: customFilling,
        frosting: customFrosting,
        inscription: customInscription,
        deliveryDate: customDate,
        deliveryTimeSlot: customTimeSlot,
        referenceImageUrl: customRefImageUrl,
        designNotes: customDesignNotes,
      },
      unitPrice: computedCustomCakePrice,
      quantity: 1,
    };
    addToCart(customItem);
    navigate('/cart');
  };

  // --------------------------------------------------------------------------
  // 8. CHECKOUT & ORDER PLACEMENT STATE (HOME DELIVERY / PICKUP / DINE-IN QR)
  // --------------------------------------------------------------------------
  const [checkoutFulfilment, setCheckoutFulfilment] = useState<'delivery' | 'pickup' | 'dine_in'>(
    activeTableQr ? 'dine_in' : 'delivery'
  );
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutWhatsapp, setCheckoutWhatsapp] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutPinCode, setCheckoutPinCode] = useState('231217');
  const [checkoutPickupDate, setCheckoutPickupDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [checkoutPickupSlot, setCheckoutPickupSlot] = useState('4:00 PM – 6:00 PM');
  const [checkoutTableNumber, setCheckoutTableNumber] = useState(activeTableQr || 'T-01');
  const [checkoutSpecialNotes, setCheckoutSpecialNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<
    'cod' | 'pay_at_pickup' | 'pay_at_counter' | 'razorpay_online'
  >('cod');
  const [razorpayConfig, setRazorpayConfig] = useState<{
    razorpayConfigured: boolean;
    razorpayKeyId: string | null;
  }>({ razorpayConfigured: false, razorpayKeyId: null });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [latestPlacedOrder, setLatestPlacedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    fetch('/api/payments/config')
      .then((r) => r.json())
      .then((d) => setRazorpayConfig(d))
      .catch(() => {});
  }, []);

  // Client-side preview calculation (verified by /api/orders/verify-pricing on submit)
  const cartCalculations = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) => sum + Math.round(item.unitPrice * item.quantity),
      0
    );
    const hasQuotationItem = cart.some((item) => Boolean(item.isQuotationBased));
    let discountAmount = 0;
    if (appliedCouponCode) {
      const found = coupons.find(
        (c) =>
          c.code.toUpperCase() === appliedCouponCode.toUpperCase() &&
          c.isActive &&
          subtotal >= c.minCartValue
      );
      if (found) {
        discountAmount =
          found.discountType === 'percentage'
            ? Math.round((subtotal * found.discountValue) / 100)
            : Math.min(subtotal, found.discountValue);
      }
    }

    const activePinZone = deliveryZones.find(
      (z) => z.pinCode.trim() === checkoutPinCode.trim()
    );
    const isPinServiceable =
      checkoutFulfilment !== 'delivery' || Boolean(activePinZone && activePinZone.isServiceable);

    let deliveryFee = 0;
    if (checkoutFulfilment === 'delivery') {
      if (subtotal - discountAmount >= settings.freeDeliveryThreshold) {
        deliveryFee = 0;
      } else {
        deliveryFee = activePinZone ? activePinZone.deliveryFee : settings.baseDeliveryFee;
      }
    }

    const packagingCharge =
      checkoutFulfilment === 'dine_in' ? 0 : settings.packagingCharge;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round((taxable * settings.taxPercentage) / 100);
    const totalAmount = taxable + deliveryFee + packagingCharge + taxAmount;

    // Preview Advance Payment Calculation (authoritatively verified on server in /api/orders/verify-pricing)
    let advanceRequired = false;
    if (checkoutFulfilment === 'delivery' && paymentSettings.mandatoryForDelivery) {
      advanceRequired = true;
    } else if (checkoutFulfilment === 'pickup' && paymentSettings.mandatoryForPickup) {
      advanceRequired = true;
    }
    if (hasQuotationItem && !paymentSettings.requireAdvanceForQuotation) {
      advanceRequired = false;
    }

    let requiredAdvanceAmount = 0;
    let advanceRuleLabel = '';
    if (advanceRequired && totalAmount > 0) {
      const useSeparate = Boolean(paymentSettings.useSeparateRulesByOrderType);
      const ruleType =
        useSeparate && checkoutFulfilment === 'pickup'
          ? paymentSettings.pickupAdvanceType || 'percentage'
          : paymentSettings.advanceType || 'percentage';
      const rulePct =
        useSeparate && checkoutFulfilment === 'pickup'
          ? paymentSettings.pickupAdvancePercentage ?? 20
          : paymentSettings.advancePercentage ?? 20;
      const ruleFixed =
        useSeparate && checkoutFulfilment === 'pickup'
          ? paymentSettings.pickupFixedAdvanceAmount ?? 150
          : paymentSettings.fixedAdvanceAmount ?? 200;

      let rawAdv = ruleType === 'fixed' ? ruleFixed : Math.round((totalAmount * rulePct) / 100);
      rawAdv = Math.max(paymentSettings.minAdvanceAmount ?? 100, rawAdv);
      rawAdv = Math.min(paymentSettings.maxAdvanceAmount ?? 10000, rawAdv);
      requiredAdvanceAmount = Math.min(totalAmount, Math.round(rawAdv));
      advanceRuleLabel =
        ruleType === 'fixed' ? `Fixed Advance` : `${rulePct}% Advance`;
    }

    const remainingBalanceAmount = Math.max(0, totalAmount - requiredAdvanceAmount);

    return {
      subtotal,
      discountAmount,
      deliveryFee,
      packagingCharge,
      taxAmount,
      totalAmount,
      activePinZone,
      isPinServiceable,
      advanceRequired,
      requiredAdvanceAmount,
      remainingBalanceAmount,
      advanceRuleLabel,
    };
  }, [
    cart,
    appliedCouponCode,
    coupons,
    deliveryZones,
    checkoutPinCode,
    checkoutFulfilment,
    settings,
    paymentSettings,
  ]);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const found = coupons.find((c) => c.code.toUpperCase() === code && c.isActive);
    if (!found) {
      setCheckoutError(`Coupon "${code}" is invalid or expired.`);
      return;
    }
    if (cartCalculations.subtotal < found.minCartValue) {
      setCheckoutError(
        `Coupon "${code}" requires a minimum cart subtotal of ₹${found.minCartValue}.`
      );
      return;
    }
    setCheckoutError(null);
    setAppliedCouponCode(found.code);
  };

  // Place Order with Server-Side Price & Advance Calculation + Atomic Firestore Batch
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setCheckoutError(null);

    if (!checkoutName.trim() || !checkoutPhone.trim()) {
      setCheckoutError('Please enter your full name and 10-digit mobile number.');
      return;
    }

    if (checkoutFulfilment === 'delivery' && !checkoutAddress.trim()) {
      setCheckoutError('Please enter your complete delivery address and landmark in Renukoot.');
      return;
    }

    setPlacingOrder(true);
    try {
      // 1. Server-side price, PIN code serviceability & advance payment calculation
      const verifyRes = await fetch('/api/orders/verify-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            isQuotationBased: i.isQuotationBased,
          })),
          fulfilmentType: checkoutFulfilment,
          pinCode: checkoutPinCode,
          couponCode: appliedCouponCode || '',
          deliveryZones,
          coupons,
          settings,
          paymentSettings,
        }),
      });

      const verifiedData = await verifyRes.json();
      if (!verifyRes.ok || !verifiedData.verified) {
        throw new Error(verifiedData.error || 'Order verification failed.');
      }

      // 2. Construct Unique Order Number & Detailed Multi-Variant Items Summary
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const orderNumber = `LVY-${dateStr}-${randomSuffix}`;

      const itemsSummaryLines = cart.map((item) => {
        const variantParts = [`Size: ${item.selectedSizeLabel}`];
        if (item.selectedFlavorLabel) variantParts.push(`Flavor: ${item.selectedFlavorLabel}`);
        if (item.selectedFrostingLabel)
          variantParts.push(`Frosting: ${item.selectedFrostingLabel}`);
        if (item.selectedAddons.length > 0) {
          variantParts.push(`Add-ons: ${item.selectedAddons.map((a) => a.label).join(', ')}`);
        }
        if (item.cakeMessage) {
          variantParts.push(`Cake Message: "${item.cakeMessage}"`);
        }
        return `${item.quantity}x ${item.name} (${variantParts.join(' · ')}) — ₹${
          item.unitPrice * item.quantity
        }`;
      });

      const customCakeItems = cart.filter((i) => i.isCustomCake && i.customCakeMeta);
      const customCakeDetailsStr = customCakeItems
        .map(
          (c) =>
            `Occasion: ${c.customCakeMeta?.occasion} | Weight: ${c.customCakeMeta?.weightKg} | Flavour: ${c.customCakeMeta?.flavour} | Filling: ${c.customCakeMeta?.filling} | Frosting: ${c.customCakeMeta?.frosting} | Exact Inscription: "${c.customCakeMeta?.inscription}" | Slot: ${c.customCakeMeta?.deliveryDate} (${c.customCakeMeta?.deliveryTimeSlot}) | Notes: ${c.customCakeMeta?.designNotes || 'None'}`
        )
        .join('\n');

      const isAdvanceRequired = Boolean(verifiedData.advanceRequired);
      const requiredAdvanceAmount = Number(verifiedData.requiredAdvanceAmount || 0);
      const remainingBalanceAmount = Number(
        verifiedData.remainingBalanceAmount ?? verifiedData.totalAmount
      );
      const paymentDeadlineIso = String(verifiedData.paymentDeadlineIso || '');

      const initialStatus = verifiedData.hasQuotationItem
        ? 'awaiting_quote'
        : isAdvanceRequired
        ? 'awaiting_advance_payment'
        : 'new_order';

      const initialPaymentStatus = isAdvanceRequired ? 'AWAITING_PAYMENT' : 'pending';
      const effectivePaymentMethod = isAdvanceRequired
        ? 'manual_upi_advance'
        : checkoutPaymentMethod;
      const nowIso = new Date().toISOString();
      const userId = currentUser?.uid || 'guest';

      const fullOrderRecord: OrderRecord = {
        orderNumber,
        userId,
        customerName: checkoutName.trim(),
        customerPhone: checkoutPhone.trim(),
        customerWhatsapp: (checkoutWhatsapp || checkoutPhone).trim(),
        customerEmail: checkoutEmail.trim(),
        fulfilmentType: checkoutFulfilment,
        orderStatus: initialStatus,
        paymentMethod: effectivePaymentMethod,
        paymentStatus: initialPaymentStatus,
        advanceRequired: isAdvanceRequired,
        requiredAdvanceAmount,
        submittedAdvanceAmount: 0,
        verifiedAdvanceAmount: 0,
        remainingBalanceAmount,
        paymentDeadlineIso,
        deliveryAddress: checkoutFulfilment === 'delivery' ? checkoutAddress.trim() : '',
        pinCode: checkoutFulfilment === 'delivery' ? checkoutPinCode.trim() : '',
        pickupDate: checkoutPickupDate,
        pickupTimeSlot: checkoutPickupSlot,
        tableNumber: checkoutFulfilment === 'dine_in' ? checkoutTableNumber : '',
        specialInstructions: checkoutSpecialNotes.trim(),
        couponCode: verifiedData.appliedCoupon || '',
        subtotal: verifiedData.subtotal,
        discountAmount: verifiedData.discountAmount,
        deliveryFee: verifiedData.deliveryFee,
        packagingCharge: verifiedData.packagingCharge,
        taxAmount: verifiedData.taxAmount,
        totalAmount: verifiedData.totalAmount,
        itemsSummary: itemsSummaryLines.join('\n'),
        customCakeDetails: customCakeDetailsStr,
        adminNotes: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const orderPaymentDoc: OrderPaymentRecord = {
        orderNumber,
        userId,
        customerName: checkoutName.trim(),
        customerPhone: checkoutPhone.trim(),
        fulfilmentType: checkoutFulfilment,
        totalOrderAmount: verifiedData.totalAmount,
        advanceRequired: isAdvanceRequired,
        requiredAdvanceAmount,
        submittedAmount: 0,
        verifiedAdvanceAmount: 0,
        remainingBalanceAmount,
        paymentStatus: isAdvanceRequired ? 'AWAITING_PAYMENT' : 'NOT_REQUIRED',
        paymentDeadlineIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // 3. Atomic WriteBatch to /orders/{orderNumber}, /order_summaries/{orderNumber}, /order_payments/{orderNumber}, and /payment_verification_history
      const batch = writeBatch(db);
      batch.set(doc(db, 'orders', orderNumber), fullOrderRecord);
      batch.set(doc(db, 'order_summaries', orderNumber), {
        orderNumber,
        userId,
        fulfilmentType: checkoutFulfilment,
        orderStatus: initialStatus,
        paymentMethod: effectivePaymentMethod,
        paymentStatus: initialPaymentStatus,
        advanceRequired: isAdvanceRequired,
        requiredAdvanceAmount,
        submittedAdvanceAmount: 0,
        verifiedAdvanceAmount: 0,
        remainingBalanceAmount,
        paymentDeadlineIso,
        totalAmount: verifiedData.totalAmount,
        itemsSummary: fullOrderRecord.itemsSummary,
        pickupDate: checkoutPickupDate,
        pickupTimeSlot: checkoutPickupSlot,
        tableNumber: fullOrderRecord.tableNumber || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      batch.set(doc(db, 'order_payments', orderNumber), orderPaymentDoc);

      if (isAdvanceRequired) {
        const initHistId = `hist-create-${orderNumber}`;
        batch.set(doc(db, 'payment_verification_history', initHistId), {
          id: initHistId,
          orderNumber,
          action: 'ORDER_CREATED_AWAITING_ADVANCE',
          actorRole: 'customer',
          actorIdentifier: `${checkoutName.trim()} (${checkoutPhone.trim()})`,
          amount: requiredAdvanceAmount,
          note: `Order created for ${checkoutFulfilment.toUpperCase()}. Total: ₹${
            verifiedData.totalAmount
          }, Required Advance: ₹${requiredAdvanceAmount}, Remaining Balance: ₹${remainingBalanceAmount}.`,
          createdAt: nowIso,
        });
      }

      await batch.commit();

      setLatestPlacedOrder(fullOrderRecord);
      setCart([]);
      navigate(`/order/${orderNumber}`);
    } catch (err: any) {
      setCheckoutError(err.message || 'Could not place order. Please review your details.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // --------------------------------------------------------------------------
  // 9. PUBLIC ORDER TRACKING (/track-order and /order/[orderNumber])
  // --------------------------------------------------------------------------
  const [trackInputNumber, setTrackInputNumber] = useState('');
  const [trackedSummary, setTrackedSummary] = useState<any | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  const fetchOrderSummaryByNumber = async (ordNum: string) => {
    const clean = ordNum.trim().toUpperCase();
    if (!clean) return;
    setTrackLoading(true);
    setTrackError(null);
    try {
      const snap = await getDoc(doc(db, 'order_summaries', clean));
      if (!snap.exists()) {
        setTrackedSummary(null);
        setTrackError(
          `No order found matching "${clean}". Please verify your LVY- order number or call +91 80905 29971.`
        );
      } else {
        setTrackedSummary(snap.data());
      }
    } catch (err: any) {
      setTrackError(err.message || 'Unable to retrieve order status.');
    } finally {
      setTrackLoading(false);
    }
  };

  useEffect(() => {
    if (currentPath.startsWith('/order/') || currentPath.startsWith('/payment/')) {
      const ordNum = currentPath
        .replace('/order/', '')
        .replace('/payment/', '')
        .trim();
      if (ordNum) {
        fetchOrderSummaryByNumber(ordNum);
      }
    }
  }, [currentPath]);

  // --------------------------------------------------------------------------
  // 10. ADMIN ROUTE DELEGATION (/admin/*)
  // --------------------------------------------------------------------------
  if (currentPath.startsWith('/admin')) {
    return (
      <>
        {mapsQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-300 text-amber-900 px-4 py-2.5 text-xs flex items-center justify-between">
            <span>
              Google Maps demo key quota reached. For uninterrupted maps, add your own Google Maps API key in Settings &gt; Secrets.
            </span>
            <button
              type="button"
              onClick={() => setMapsQuotaExceeded(false)}
              className="font-bold underline ml-3"
            >
              Dismiss
            </button>
          </div>
        )}
        <AdminDashboard
          currentPath={currentPath}
          onNavigate={navigate}
          userEmail={passwordAuthEmail || currentUser?.email || null}
          isAdminUser={isAdminUser}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleGoogleSignOut}
          onPasswordAuthSuccess={(account) => {
            setPasswordAuthEmail(account.email);
          }}
          settings={settings}
          paymentSettings={paymentSettings}
          categories={categories}
          products={products}
          cakeDesigns={cakeDesigns}
          mediaAssets={mediaAssets}
          coupons={coupons}
          deliveryZones={deliveryZones}
          diningTables={diningTables}
          orders={adminOrders}
          orderPayments={adminOrderPayments}
          paymentSubmissions={adminPaymentSubmissions}
          paymentHistory={adminPaymentHistory}
          websiteConfig={websiteConfig}
          customPages={customPages}
          staffMembers={staffMembers}
          roleDefinitions={roleDefinitions}
          inventoryLogs={inventoryLogs}
          rawMaterials={rawMaterials}
          customerCrmNotes={customerCrmNotes}
          adminNotifications={adminNotifications}
          auditLogs={auditLogs}
          backupRecords={backupRecords}
        />
      </>
    );
  }

  // Filter published products for customer views
  const publishedProducts = products.filter((p) => p.isAvailable);
  const bestsellerProducts = publishedProducts.filter((p) => p.isBestseller);

  // Determine active Product Detail Page (PDP) product if on /menu/[slug] or /cakes/[slug]
  const activePdpSlug = currentPath.startsWith('/menu/')
    ? currentPath.replace('/menu/', '')
    : currentPath.startsWith('/cakes/')
    ? currentPath.replace('/cakes/', '')
    : null;
  const activePdpProduct = activePdpSlug
    ? publishedProducts.find((p) => p.slug === activePdpSlug || p.id === activePdpSlug) || null
    : null;

  // Determine active Category filter if on /categories/[slug]
  const routeCategorySlug = currentPath.startsWith('/categories/')
    ? currentPath.replace('/categories/', '')
    : null;

  const cartTotalCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8F1] text-[#3B2824]">
      {/* GOOGLE MAPS TIER 2 QUOTA ALERT BANNER */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-300 text-amber-900 px-4 py-2.5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Google Maps shared demo key quota exceeded. You can still open Lovey&apos;s Bakery &amp; Pizza Corners directly on Google Maps or configure a personal key.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            className="font-bold underline ml-3 whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. ANNOUNCEMENT BAR */}
      {settings.announcementActive && (
        <div className="bg-[#3B2824] text-[#FFF8F1] px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium truncate">
              {lang === 'hi' ? settings.announcementTextHi : settings.announcementText}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              {activeTableQr && (
                <span className="text-[#E5B867] font-bold flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5" />
                  Dine-In Table {activeTableQr} Active
                </span>
              )}
              <a
                href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                className="font-mono-num hover:text-[#E5B867] transition-colors hidden sm:inline"
              >
                {settings.phone}
              </a>
              <button
                type="button"
                onClick={() => setLang((prev) => (prev === 'en' ? 'hi' : 'en'))}
                className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[11px] font-semibold"
              >
                {lang === 'en' ? 'EN · हिंदी' : 'हिंदी · EN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOP NAVIGATION BAR (3-Zone Contract: Brand Left, Links Center, Search/AI/Cart Right) */}
      <header className="sticky top-0 z-40 bg-[#FFF8F1]/95 backdrop-blur-md border-b border-[#E6D7C8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Identity */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-left group shrink-0"
          >
            <span className="block font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#3B2824] group-hover:text-[#B94E62] transition-colors">
              LOVEY&apos;S
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[#6B544E] font-semibold">
              {lang === 'hi' ? 'लवी’स बेकरी & पिज्जा कॉर्नर्स' : 'Bakery & Pizza Corners · Renukoot'}
            </span>
          </button>

          {/* Zone 2: Primary Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 xl:gap-8 text-sm font-medium text-[#3B2824]">
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`hover:text-[#B94E62] transition-colors whitespace-nowrap ${
                currentPath === '/' ? 'text-[#B94E62] font-semibold' : ''
              }`}
            >
              {lang === 'hi' ? 'होम' : 'Home'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className={`hover:text-[#B94E62] transition-colors whitespace-nowrap ${
                currentPath.startsWith('/menu') ? 'text-[#B94E62] font-semibold' : ''
              }`}
            >
              {lang === 'hi' ? 'मेनू' : 'Explore Menu'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/cakes')}
              className={`hover:text-[#B94E62] transition-colors whitespace-nowrap ${
                currentPath.startsWith('/cakes') ? 'text-[#B94E62] font-semibold' : ''
              }`}
            >
              {lang === 'hi' ? 'केक' : 'Cakes'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/gallery')}
              className={`hover:text-[#B94E62] transition-colors whitespace-nowrap ${
                currentPath === '/gallery' ? 'text-[#B94E62] font-semibold' : ''
              }`}
            >
              {lang === 'hi' ? 'गैलरी' : 'Gallery'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/about')}
              className={`hover:text-[#B94E62] transition-colors whitespace-nowrap ${
                currentPath === '/about' ? 'text-[#B94E62] font-semibold' : ''
              }`}
            >
              {lang === 'hi' ? 'हमारी कहानी' : 'Our Story'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className={`hover:text-[#B94E62] transition-colors whitespace-nowrap ${
                currentPath === '/contact' ? 'text-[#B94E62] font-semibold' : ''
              }`}
            >
              {lang === 'hi' ? 'संपर्क' : 'Contact'}
            </button>
          </nav>

          {/* Zone 3: Custom Cake CTA, Track Order & Cart */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/custom-cake')}
              className={`hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                currentPath === '/custom-cake'
                  ? 'bg-[#E6D7C8] text-[#3B2824] ring-1 ring-[#B94E62]/40'
                  : 'bg-[#F5EBE1] hover:bg-[#E6D7C8] text-[#3B2824]'
              }`}
            >
              <Cake className="w-3.5 h-3.5 text-[#B94E62]" />
              <span>{lang === 'hi' ? 'कस्टम केक' : 'Custom Cake'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/track-order')}
              className="hidden sm:inline-flex px-3 py-2 rounded-xl border border-[#E6D7C8] hover:bg-[#F5EBE1] text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Track Order
            </button>

            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="px-4 py-2.5 rounded-xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Cart</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/15 font-mono-num text-[11px]">
                {cartTotalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl border border-[#E6D7C8] text-[#3B2824]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-[#E6D7C8] px-4 py-4 space-y-1.5 text-sm font-semibold">
            {[
              { path: '/', label: lang === 'hi' ? 'होम' : 'Home' },
              { path: '/menu', label: lang === 'hi' ? 'मेनू' : 'Explore Menu' },
              { path: '/cakes', label: lang === 'hi' ? 'केक' : 'Cakes' },
              { path: '/gallery', label: lang === 'hi' ? 'गैलरी' : 'Gallery' },
              { path: '/about', label: lang === 'hi' ? 'हमारी कहानी' : 'Our Story' },
              { path: '/contact', label: lang === 'hi' ? 'संपर्क' : 'Contact' },
              { path: '/track-order', label: 'Track Order' },
              { path: '/admin/login', label: 'Business Admin / Staff Login' },
            ].map((lnk) => (
              <button
                key={lnk.path}
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(lnk.path);
                }}
                className={`block w-full text-left py-2 px-3 rounded-xl transition-colors ${
                  currentPath === lnk.path
                    ? 'bg-[#F5EBE1] text-[#B94E62]'
                    : 'hover:bg-[#F5EBE1] text-[#3B2824]'
                }`}
              >
                {lnk.label}
              </button>
            ))}

            {/* Highlighted Custom Cake CTA Button for Mobile Screens (< sm where header CTA is hidden) */}
            <div className="sm:hidden pt-2 border-t border-[#E6D7C8]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/custom-cake');
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F5EBE1] hover:bg-[#E6D7C8] text-[#3B2824] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Cake className="w-4 h-4 text-[#B94E62]" />
                <span>{lang === 'hi' ? 'कस्टम केक' : 'Custom Cake'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Floating Cart Toast Notification */}
      {cartFeedbackBanner && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#3B2824] text-[#FFF8F1] px-5 py-3.5 rounded-2xl shadow-xl border border-[#E5B867]/40 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-[#E5B867] shrink-0" />
          <span className="text-xs font-medium">{cartFeedbackBanner}</span>
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="text-xs font-bold text-[#E5B867] underline ml-2 whitespace-nowrap"
          >
            View Cart
          </button>
        </div>
      )}

      {/* Gallery Lightbox Viewing Modal */}
      {lightboxAsset && (
        <div
          onClick={() => setLightboxAsset(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-[#1E1412] border border-[#49332E] rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3B2824] text-[#FFF8F1]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#E5B867] font-semibold">
                  {(lightboxAsset.section || lightboxAsset.category || 'Lovey’s Gallery').replace('_', ' ')}
                </p>
                <h3 className="font-serif text-lg sm:text-xl font-bold">{lightboxAsset.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxAsset(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF8F1]"
                aria-label="Close Lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[75vh] overflow-hidden">
              {lightboxAsset.mediaType === 'video' ||
              /\.(mp4|webm|ogg)$/i.test(lightboxAsset.imageUrl || lightboxAsset.url || '') ? (
                <video
                  src={lightboxAsset.imageUrl || lightboxAsset.url}
                  controls
                  playsInline
                  className="max-h-[72vh] w-auto object-contain"
                />
              ) : (
                <img
                  src={lightboxAsset.imageUrl || lightboxAsset.url}
                  alt={lightboxAsset.altText || lightboxAsset.title}
                  className="max-h-[72vh] w-auto object-contain"
                />
              )}
            </div>
            <div className="px-6 py-3.5 bg-[#1E1412] border-t border-[#3B2824] flex flex-wrap items-center justify-between gap-3 text-xs text-[#D7C4B7]">
              <span>{lightboxAsset.altText || lightboxAsset.title}</span>
              <button
                type="button"
                onClick={() => {
                  setLightboxAsset(null);
                  navigate('/custom-cake');
                }}
                className="px-4 py-2 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white font-semibold"
              >
                Customise a Similar Cake &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ROUTE VIEWS */}
      {/* ==================================================================== */}
      <main className="flex-1">
        {/* ------------------------------------------------------------------ */}
        {/* VIEW A: PRODUCT DETAIL PAGE (/menu/[slug] or /cakes/[slug]) */}
        {/* ------------------------------------------------------------------ */}
        {activePdpProduct ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {(() => {
              const sizeOptions = parseVariantOptions(activePdpProduct.variantsSummary);
              const flavorOptions = activePdpProduct.flavorsSummary
                ? parseVariantOptions(activePdpProduct.flavorsSummary)
                : [];
              const frostingOptions = activePdpProduct.frostingsSummary
                ? parseVariantOptions(activePdpProduct.frostingsSummary)
                : [];
              const addonOptions = parseAddonOptions(activePdpProduct.addonsSummary);

              const selectedSize = sizeOptions[pdpSizeIdx] || sizeOptions[0] || {
                label: 'Standard',
                priceDelta: 0,
              };
              const selectedFlavor = flavorOptions[pdpFlavorIdx] || flavorOptions[0] || null;
              const selectedFrosting =
                frostingOptions[pdpFrostingIdx] || frostingOptions[0] || null;

              const addonsTotal = addonOptions
                .filter((a) => pdpSelectedAddons.includes(a.label))
                .reduce((s, a) => s + a.price, 0);

              const pdpBasePrice = activePdpProduct.basePrice ?? activePdpProduct.price ?? 0;
              const pdpComparePrice = activePdpProduct.compareAtPrice ?? activePdpProduct.originalPrice ?? 0;
              const computedUnitPrice =
                pdpBasePrice +
                (selectedSize?.priceDelta || 0) +
                (selectedFlavor?.priceDelta || 0) +
                (selectedFrosting?.priceDelta || 0) +
                addonsTotal;

              return (
                <div className="space-y-12">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-2 text-xs text-[#6B544E]">
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="hover:text-[#B94E62]"
                    >
                      Home
                    </button>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <button
                      type="button"
                      onClick={() => navigate('/menu')}
                      className="hover:text-[#B94E62]"
                    >
                      {activePdpProduct.categoryName || activePdpProduct.categorySlug || 'Bakery Menu'}
                    </button>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="text-[#3B2824] font-semibold">{activePdpProduct.name}</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 bg-white border border-[#E6D7C8] rounded-3xl p-6 sm:p-10 shadow-xs">
                    {/* Left Photo */}
                    <div className="lg:col-span-6 space-y-4">
                      <div className="aspect-4/3 rounded-2xl overflow-hidden bg-[#F5EBE1] border border-[#E6D7C8]">
                        <img
                          src={activePdpProduct.imageUrl}
                          alt={activePdpProduct.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] text-xs space-y-1.5">
                        <p className="font-semibold text-[#3B2824]">
                          Ingredients &amp; Allergen Transparency
                        </p>
                        <p className="text-[#6B544E]">
                          {activePdpProduct.ingredientsSummary || activePdpProduct.description}
                        </p>
                        <p className="text-[#2D6A4F] font-medium">
                          {activePdpProduct.allergenInfo || '100% Eggless Artisan Recipe'} · Freshly prepared to order at our Renukoot kitchen
                        </p>
                      </div>
                    </div>

                    {/* Right Multi-Dimensional Variant Configurator */}
                    <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#B94E62] font-semibold">
                          {activePdpProduct.categoryName || activePdpProduct.categorySlug} ·{' '}
                          {activePdpProduct.isEggless ? '100% Eggless' : 'Artisan Recipe'} ·{' '}
                          {activePdpProduct.sameDayAvailable !== false
                            ? 'Same-Day Delivery'
                            : `${activePdpProduct.advanceNoticeHours || 4}h Advance Notice`}
                        </p>

                        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#3B2824]">
                          {lang === 'hi' && (activePdpProduct.nameHi || activePdpProduct.hindiName)
                            ? activePdpProduct.nameHi || activePdpProduct.hindiName
                            : activePdpProduct.name}
                        </h1>

                        <p className="text-sm text-[#6B544E] leading-relaxed">
                          {activePdpProduct.fullDescription ||
                            activePdpProduct.shortDescription ||
                            activePdpProduct.description}
                        </p>

                        {/* Live Dynamic Price Display */}
                        <div className="flex items-baseline gap-3 pt-2 border-t border-[#E6D7C8]">
                          <span className="font-serif text-3xl font-bold font-mono-num text-[#3B2824]">
                            ₹{computedUnitPrice}
                          </span>
                          {pdpComparePrice > pdpBasePrice && (
                            <span className="text-sm text-[#6B544E] line-through font-mono-num">
                              ₹
                              {pdpComparePrice +
                                (selectedSize?.priceDelta || 0) +
                                (selectedFlavor?.priceDelta || 0) +
                                (selectedFrosting?.priceDelta || 0)}
                            </span>
                          )}
                          <span className="text-xs text-[#2D6A4F] font-semibold">
                            Inclusive of variant adjustments
                          </span>
                        </div>

                        {/* 1. SIZE / WEIGHT SELECTOR */}
                        {sizeOptions.length > 0 && (
                          <div className="pt-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#3B2824] mb-2">
                              1. Select Size / Weight
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {sizeOptions.map((opt, idx) => (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => setPdpSizeIdx(idx)}
                                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                                    pdpSizeIdx === idx
                                      ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                                      : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8] hover:border-[#3B2824]'
                                  }`}
                                >
                                  <p className="text-xs font-bold">{opt.label}</p>
                                  <p className="text-[11px] font-mono-num opacity-80">
                                    {opt.priceDelta === 0
                                      ? 'Base Price'
                                      : `+₹${opt.priceDelta}`}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. FLAVOR SELECTOR */}
                        {flavorOptions.length > 0 && (
                          <div className="pt-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#3B2824] mb-2">
                              2. Select Sponge / Flavour Profile
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {flavorOptions.map((opt, idx) => (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => setPdpFlavorIdx(idx)}
                                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                                    pdpFlavorIdx === idx
                                      ? 'bg-[#B94E62] text-white border-[#B94E62]'
                                      : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8] hover:border-[#B94E62]'
                                  }`}
                                >
                                  <p className="text-xs font-bold">{opt.label}</p>
                                  <p className="text-[11px] font-mono-num opacity-85">
                                    {opt.priceDelta === 0 ? 'Included' : `+₹${opt.priceDelta}`}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 3. FROSTING SELECTOR */}
                        {frostingOptions.length > 0 && (
                          <div className="pt-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#3B2824] mb-2">
                              3. Select Frosting &amp; Finish
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {frostingOptions.map((opt, idx) => (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => setPdpFrostingIdx(idx)}
                                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                                    pdpFrostingIdx === idx
                                      ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                                      : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8] hover:border-[#3B2824]'
                                  }`}
                                >
                                  <p className="text-xs font-bold">{opt.label}</p>
                                  <p className="text-[11px] font-mono-num opacity-85">
                                    {opt.priceDelta === 0 ? 'Included' : `+₹${opt.priceDelta}`}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 4. OPTIONAL ADD-ONS */}
                        {addonOptions.length > 0 && (
                          <div className="pt-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#3B2824] mb-2">
                              4. Celebration Add-Ons &amp; Toppers
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {addonOptions.map((addon) => {
                                const isChecked = pdpSelectedAddons.includes(addon.label);
                                return (
                                  <button
                                    key={addon.label}
                                    type="button"
                                    onClick={() =>
                                      setPdpSelectedAddons((prev) =>
                                        isChecked
                                          ? prev.filter((l) => l !== addon.label)
                                          : [...prev, addon.label]
                                      )
                                    }
                                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                                      isChecked
                                        ? 'bg-[#E5B867] text-[#3B2824] border-[#3B2824]'
                                        : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8]'
                                    }`}
                                  >
                                    {addon.label} (+₹{addon.price})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 5. CAKE INSCRIPTION MESSAGE */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#3B2824] mb-1">
                              Message on Cake / Plate (Optional)
                            </label>
                            <input
                              type="text"
                              maxLength={60}
                              value={pdpCakeMessage}
                              onChange={(e) => setPdpCakeMessage(e.target.value)}
                              placeholder="e.g. Happy Birthday Riya!"
                              className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#3B2824] mb-1">
                              Special Kitchen Note
                            </label>
                            <input
                              type="text"
                              value={pdpSpecialNote}
                              onChange={(e) => setPdpSpecialNote(e.target.value)}
                              placeholder="e.g. Less sweet / extra hot"
                              className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quantity & Add to Cart Action */}
                      <div className="pt-6 border-t border-[#E6D7C8] flex flex-wrap items-center gap-4">
                        <div className="flex items-center border border-[#E6D7C8] rounded-xl bg-[#FFF8F1]">
                          <button
                            type="button"
                            onClick={() => setPdpQuantity((q) => Math.max(1, q - 1))}
                            className="p-3 text-[#3B2824] hover:text-[#B94E62]"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-4 font-mono-num text-sm font-bold">
                            {pdpQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPdpQuantity((q) => q + 1)}
                            className="p-3 text-[#3B2824] hover:text-[#B94E62]"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const chosenAddonObjs = addonOptions.filter((a) =>
                              pdpSelectedAddons.includes(a.label)
                            );
                            addToCart({
                              cartItemId: `${activePdpProduct.id}-${Date.now()}`,
                              productId: activePdpProduct.id,
                              name: activePdpProduct.name,
                              nameHi: activePdpProduct.nameHi || activePdpProduct.hindiName,
                              slug: activePdpProduct.slug,
                              imageUrl: activePdpProduct.imageUrl,
                              basePrice: pdpBasePrice,
                              selectedSizeLabel: selectedSize.label,
                              selectedSizeDelta: selectedSize.priceDelta,
                              selectedFlavorLabel: selectedFlavor?.label,
                              selectedFlavorDelta: selectedFlavor?.priceDelta || 0,
                              selectedFrostingLabel: selectedFrosting?.label,
                              selectedFrostingDelta: selectedFrosting?.priceDelta || 0,
                              selectedAddons: chosenAddonObjs,
                              cakeMessage: pdpCakeMessage,
                              specialInstructions: pdpSpecialNote,
                              isEggless: activePdpProduct.isEggless,
                              unitPrice: computedUnitPrice,
                              quantity: pdpQuantity,
                            });
                          }}
                          className="flex-1 py-3.5 px-6 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>
                            Add to Cart · ₹{computedUnitPrice * pdpQuantity}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        ) : currentPath === '/custom-cake' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW B: CUSTOM CAKE STUDIO (/custom-cake) */
          /* ------------------------------------------------------------------ */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E6D7C8] pb-8">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#B94E62] font-semibold mb-2">
                  Lovey&apos;s Bespoke Celebration Atelier
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#3B2824]">
                  Custom Cake Ordering Studio
                </h1>
                <p className="text-sm text-[#6B544E] mt-2 max-w-2xl">
                  Configure your exact cake weight, 100% eggless sponge flavour, filling, frosting finish, and celebration inscription—freshly handcrafted by our pastry chefs in Renukoot.
                </p>
              </div>
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                  "Hello Lovey's Bakery & Pizza Corners! I would like to discuss a custom celebration cake design."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-2xl bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#23533D] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                Discuss Custom Cake on WhatsApp
              </a>
            </div>

            {/* Signature Templates */}
            <div>
              <h2 className="font-serif text-2xl font-bold mb-4">
                1. Start from a Signature Lovey&apos;s Custom Design (Or Build From Scratch Below)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {cakeDesigns
                  .filter((cd) => cd.isActive)
                  .map((cd) => (
                    <div
                      key={cd.id}
                      className="bg-white border border-[#E6D7C8] rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xs"
                    >
                      <img
                        src={cd.imageUrl}
                        alt={cd.title || cd.name || 'Custom Cake'}
                        referrerPolicy="no-referrer"
                        className="w-full h-44 object-cover"
                      />
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#B94E62]">
                            {cd.occasion || cd.theme || 'Celebration'} · Min {cd.minWeightKg || 1} kg
                          </p>
                          <h3 className="font-serif text-lg font-bold mt-0.5">{cd.title || cd.name}</h3>
                          <p className="text-xs text-[#6B544E] mt-1 line-clamp-2">
                            {cd.description}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-[#E6D7C8] flex items-center justify-between">
                          <span className="font-mono-num text-xs font-bold">
                            From ₹{cd.startingPrice ?? cd.basePrice ?? 950}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomOccasion(cd.occasion || cd.theme || 'Birthday Celebration');
                              setCustomRefImageUrl(cd.imageUrl);
                              setCustomDesignNotes(`Template: ${cd.title || cd.name}`);
                              setCustomIsQuotation(cd.isQuotationBased);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#F5EBE1] hover:bg-[#3B2824] hover:text-white text-xs font-semibold transition-colors"
                          >
                            Select Design
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Interactive Custom Cake Builder Form */}
            <form
              onSubmit={handleAddCustomCakeToCart}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white border border-[#E6D7C8] rounded-3xl p-6 sm:p-10 shadow-xs"
            >
              <div className="lg:col-span-7 space-y-6">
                <h2 className="font-serif text-2xl font-bold border-b border-[#E6D7C8] pb-3">
                  2. Customize Weight, Flavour, Frosting &amp; Inscription
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Celebration Occasion
                    </label>
                    <select
                      value={customOccasion}
                      onChange={(e) => setCustomOccasion(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
                    >
                      <option>Birthday Celebration</option>
                      <option>Wedding &amp; Engagement</option>
                      <option>Milestone Anniversary</option>
                      <option>Kids Theme Party</option>
                      <option>Baby Shower / Welcome</option>
                      <option>Corporate Celebration</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Select Cake Weight &amp; Tier Size
                    </label>
                    <select
                      value={customWeightKg}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomWeightKg(val);
                        const num = parseFloat(val);
                        setCustomWeightMultiplier(Number.isFinite(num) ? num : 1.5);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
                    >
                      <option value="1.0 kg (Serves 10–12)">1.0 kg · Single Tier (Serves 10–12)</option>
                      <option value="1.5 kg (Serves 15–18)">1.5 kg · Tall Single Tier (Serves 15–18)</option>
                      <option value="2.0 kg (Serves 22–25)">2.0 kg · Two-Tier Celebration (Serves 22–25)</option>
                      <option value="3.0 kg (Serves 35–40)">3.0 kg · Grand Two-Tier (Serves 35–40)</option>
                      <option value="5.0 kg (Serves 60+)">5.0 kg · Three-Tier Banquet (Serves 60+)</option>
                    </select>
                  </div>
                </div>

                {/* Flavour, Filling & Frosting Selectors with Price Adjustments */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Sponge Flavour
                    </label>
                    <select
                      value={customFlavour}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomFlavour(v);
                        const match = v.match(/\+₹(\d+)/);
                        setCustomFlavourDelta(match ? Number(match[1]) : 0);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-medium"
                    >
                      <option>Belgian Dark Chocolate Truffle (+₹0)</option>
                      <option>Royal Pistachio &amp; Saffron Rasmalai (+₹180)</option>
                      <option>Classic Crimson Red Velvet (+₹120)</option>
                      <option>Madagascar Vanilla &amp; FreshPineapple (+₹0)</option>
                      <option>Caramelized Lotus Biscoff (+₹220)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Inner Layer Filling
                    </label>
                    <select
                      value={customFilling}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomFilling(v);
                        const match = v.match(/\+₹(\d+)/);
                        setCustomFillingDelta(match ? Number(match[1]) : 0);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-medium"
                    >
                      <option>Roasted Hazelnut Praline Crunch (+₹140)</option>
                      <option>Wild Berry Compote &amp; Cream (+₹90)</option>
                      <option>Dark Chocolate Fudge Ganache (+₹100)</option>
                      <option>Cream Cheese Mascarpone (+₹150)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Outer Frosting Finish
                    </label>
                    <select
                      value={customFrosting}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomFrosting(v);
                        const match = v.match(/\+₹(\d+)/);
                        setCustomFrostingDelta(match ? Number(match[1]) : 0);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-medium"
                    >
                      <option>Silky Dark Chocolate Ganache (+₹100)</option>
                      <option>Whipped Cream Floral Rosettes (+₹0)</option>
                      <option>Swiss Meringue Buttercream (+₹160)</option>
                      <option>Semi-Fondant Sculpted Finish (+₹350)</option>
                    </select>
                  </div>
                </div>

                {/* Exact Cake Message Inscription */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                    Exact Cake Message / Inscription (Piped Verbatim by Our Chef)
                  </label>
                  <input
                    type="text"
                    required
                    value={customInscription}
                    onChange={(e) => setCustomInscription(e.target.value)}
                    placeholder="e.g. Happy 25th Anniversary Mom & Dad!"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#3B2824] bg-[#FFF8F1] text-sm font-medium"
                  />
                </div>

                {/* Date, Time & Reference Image */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Celebration Date
                    </label>
                    <input
                      type="date"
                      required
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                      Preferred Time Slot
                    </label>
                    <select
                      value={customTimeSlot}
                      onChange={(e) => setCustomTimeSlot(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                    >
                      <option>11:00 AM – 1:00 PM</option>
                      <option>2:00 PM – 4:00 PM</option>
                      <option>5:00 PM – 7:00 PM</option>
                      <option>7:30 PM – 9:30 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                    Design Instructions, Theme Colours &amp; Reference Image URL
                  </label>
                  <textarea
                    rows={2}
                    value={customDesignNotes}
                    onChange={(e) => setCustomDesignNotes(e.target.value)}
                    placeholder="Describe pastel colours, edible pearls, floral arrangement, or custom theme..."
                    className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                  />
                </div>
              </div>

              {/* Right Live Summary Card */}
              <div className="lg:col-span-5 bg-[#FFF8F1] border border-[#E6D7C8] rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#B94E62]">
                    Live Custom Cake Blueprint
                  </span>
                  <h3 className="font-serif text-2xl font-bold">
                    {customOccasion} ({customWeightKg})
                  </h3>

                  {customRefImageUrl && (
                    <img
                      src={customRefImageUrl}
                      alt="Custom Cake Reference"
                      referrerPolicy="no-referrer"
                      className="w-full h-40 object-cover rounded-xl border border-[#E6D7C8]"
                    />
                  )}

                  <div className="space-y-2 text-xs border-t border-b border-[#E6D7C8] py-4">
                    <div className="flex justify-between">
                      <span className="text-[#6B544E]">Dietary Preference:</span>
                      <span className="font-bold text-[#2D6A4F]">100% Eggless Artisan Sponge</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B544E]">Selected Flavour:</span>
                      <span className="font-semibold text-right">{customFlavour}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B544E]">Inner Filling:</span>
                      <span className="font-semibold text-right">{customFilling}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B544E]">Frosting Finish:</span>
                      <span className="font-semibold text-right">{customFrosting}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B544E]">Exact Inscription:</span>
                      <span className="font-bold text-[#B94E62]">&ldquo;{customInscription}&rdquo;</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B544E]">Scheduled Date:</span>
                      <span className="font-mono-num font-semibold">
                        {customDate} · {customTimeSlot}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Estimated Custom Price:
                    </span>
                    <span className="font-serif text-3xl font-bold font-mono-num text-[#3B2824]">
                      ₹{computedCustomCakePrice}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-sm font-semibold transition-colors"
                  >
                    Add Custom Cake to Order Cart
                  </button>
                  <a
                    href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                    className="w-full py-2.5 rounded-xl border border-[#3B2824] text-[#3B2824] text-xs font-semibold hover:bg-[#F5EBE1] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call Bakery Desk ({settings.phone})
                  </a>
                </div>
              </div>
            </form>
          </section>
        ) : currentPath === '/cart' || currentPath === '/checkout' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW C: CART & UNIFIED CHECKOUT (/cart & /checkout) */
          /* ------------------------------------------------------------------ */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold mb-2">
              {currentPath === '/checkout'
                ? 'Complete Your Order & Fulfilment'
                : 'Your Bakery Order Cart'}
            </h1>
            <p className="text-xs text-[#6B544E] mb-8">
              All multi-dimensional variants (Size, Flavour, Frosting, Add-ons) and custom cake inscriptions are preserved below.
            </p>

            {cart.length === 0 ? (
              <div className="bg-white border border-[#E6D7C8] rounded-3xl p-12 text-center space-y-4">
                <ShoppingBag className="w-12 h-12 text-[#B94E62]/60 mx-auto" />
                <h2 className="font-serif text-2xl font-bold">Your cart is currently empty</h2>
                <p className="text-xs text-[#6B544E] max-w-md mx-auto">
                  Explore our freshly baked celebration cakes, 100% eggless pastries, and wood-fired pizzas.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/menu')}
                    className="px-6 py-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                  >
                    Explore Full Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/custom-cake')}
                    className="px-6 py-3 rounded-xl bg-[#B94E62] text-white text-xs font-semibold"
                  >
                    Order a Custom Cake
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Cart Items & Fulfilment Form */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Cart Items List */}
                  <div className="bg-white border border-[#E6D7C8] rounded-3xl p-6 space-y-4">
                    <h2 className="font-serif text-xl font-bold border-b border-[#E6D7C8] pb-3">
                      Selected Items &amp; Variant Breakdown ({cartTotalCount})
                    </h2>
                    {cart.map((item) => (
                      <div
                        key={item.cartItemId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6D7C8] last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-start gap-4">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-[#E6D7C8]"
                          />
                          <div className="space-y-1 text-xs">
                            <h3 className="font-serif text-base font-bold text-[#3B2824]">
                              {item.name}
                            </h3>
                            <p className="text-[#6B544E]">
                              <strong>Size:</strong> {item.selectedSizeLabel}
                              {item.selectedFlavorLabel
                                ? ` · Flavor: ${item.selectedFlavorLabel}`
                                : ''}
                              {item.selectedFrostingLabel
                                ? ` · Frosting: ${item.selectedFrostingLabel}`
                                : ''}
                            </p>
                            {item.selectedAddons.length > 0 && (
                              <p className="text-[#6B544E]">
                                <strong>Add-ons:</strong>{' '}
                                {item.selectedAddons.map((a) => a.label).join(', ')}
                              </p>
                            )}
                            {item.cakeMessage && (
                              <p className="text-[#B94E62] font-semibold">
                                Inscription: &ldquo;{item.cakeMessage}&rdquo;
                              </p>
                            )}
                            <p className="font-mono-num font-bold text-[#3B2824]">
                              ₹{item.unitPrice} each
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="flex items-center border border-[#E6D7C8] rounded-xl bg-[#FFF8F1]">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cartItemId, -1)}
                              className="p-2"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 font-mono-num text-xs font-bold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cartItemId, 1)}
                              className="p-2"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="font-mono-num text-sm font-bold w-16 text-right">
                            ₹{item.unitPrice * item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="p-2 text-[#B94E62] hover:bg-[#FFF5F5] rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fulfilment Mode & Guest Details Form */}
                  <form
                    id="checkout-form"
                    onSubmit={handlePlaceOrder}
                    className="bg-white border border-[#E6D7C8] rounded-3xl p-6 space-y-5"
                  >
                    <h2 className="font-serif text-xl font-bold border-b border-[#E6D7C8] pb-3">
                      Select Fulfilment Mode &amp; Contact Details
                    </h2>

                    {/* Three Fulfilment Tabs: Home Delivery, Takeaway Pickup, Dine-In Table QR */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setCheckoutFulfilment('delivery')}
                        className={`p-3.5 rounded-2xl border text-left transition-colors ${
                          checkoutFulfilment === 'delivery'
                            ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                            : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8]'
                        }`}
                      >
                        <Truck className="w-4 h-4 mb-1 text-[#E5B867]" />
                        <p className="text-xs font-bold">1. Home Delivery</p>
                        <p className="text-[11px] opacity-80">Renukoot &amp; Localities</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCheckoutFulfilment('pickup')}
                        className={`p-3.5 rounded-2xl border text-left transition-colors ${
                          checkoutFulfilment === 'pickup'
                            ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                            : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8]'
                        }`}
                      >
                        <Store className="w-4 h-4 mb-1 text-[#E5B867]" />
                        <p className="text-xs font-bold">2. Store Pickup</p>
                        <p className="text-[11px] opacity-80">No Delivery Fee</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCheckoutFulfilment('dine_in')}
                        className={`p-3.5 rounded-2xl border text-left transition-colors ${
                          checkoutFulfilment === 'dine_in'
                            ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                            : 'bg-[#FFF8F1] text-[#3B2824] border-[#E6D7C8]'
                        }`}
                      >
                        <Utensils className="w-4 h-4 mb-1 text-[#E5B867]" />
                        <p className="text-xs font-bold">3. Dine-In Table</p>
                        <p className="text-[11px] opacity-80">Zero Packaging Fee</p>
                      </button>
                    </div>

                    {/* Customer Contact Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={checkoutName}
                          onChange={(e) => setCheckoutName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          Mobile / WhatsApp Number (For Delivery Coordination) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={checkoutPhone}
                          onChange={(e) => setCheckoutPhone(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                        />
                      </div>
                    </div>

                    {/* Conditional Fulfilment Fields */}
                    {checkoutFulfilment === 'delivery' && (
                      <div className="space-y-4 p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-xs font-bold mb-1">
                              Delivery PIN Code *
                            </label>
                            <input
                              type="text"
                              required
                              value={checkoutPinCode}
                              onChange={(e) => setCheckoutPinCode(e.target.value)}
                              placeholder="231217"
                              className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num font-bold"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-end">
                            {cartCalculations.isPinServiceable &&
                            cartCalculations.activePinZone ? (
                              <p className="text-xs text-[#2D6A4F] font-semibold pb-2">
                                ✓ Serviceable: {cartCalculations.activePinZone.localityName} (Est.{' '}
                                {cartCalculations.activePinZone.estimatedTime})
                              </p>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-[#FFF5F5] border border-[#B94E62] text-xs text-[#B94E62]">
                                <strong>PIN {checkoutPinCode} is outside our home delivery zone.</strong>{' '}
                                Please switch to{' '}
                                <button
                                  type="button"
                                  onClick={() => setCheckoutFulfilment('pickup')}
                                  className="underline font-bold"
                                >
                                  Store Pickup / Takeaway
                                </button>{' '}
                                at our Renukoot outlet.
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1">
                            Complete Street Address &amp; Landmark in Renukoot / Sonbhadra *
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={checkoutAddress}
                            onChange={(e) => setCheckoutAddress(e.target.value)}
                            placeholder="House/Flat No, Colony (e.g. Hindalco Colony / Near PNB), Landmark..."
                            className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {checkoutFulfilment === 'pickup' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
                        <div>
                          <label className="block text-xs font-bold mb-1">Pickup Date</label>
                          <input
                            type="date"
                            value={checkoutPickupDate}
                            onChange={(e) => setCheckoutPickupDate(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1">Pickup Time Slot</label>
                          <select
                            value={checkoutPickupSlot}
                            onChange={(e) => setCheckoutPickupSlot(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs"
                          >
                            <option>10:30 AM – 12:30 PM</option>
                            <option>1:00 PM – 3:30 PM</option>
                            <option>4:00 PM – 6:00 PM</option>
                            <option>6:30 PM – 9:30 PM</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {checkoutFulfilment === 'dine_in' && (
                      <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
                        <label className="block text-xs font-bold mb-1.5">
                          Select Your Dine-In Table at Lovey&apos;s Pizza Corner
                        </label>
                        <select
                          value={checkoutTableNumber}
                          onChange={(e) => setCheckoutTableNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-bold"
                        >
                          {diningTables.map((t) => (
                            <option key={t.id} value={t.tableNumber}>
                              {t.label} ({t.capacity} Guests)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                        Payment &amp; Advance Verification Policy
                      </label>
                      {cartCalculations.advanceRequired ? (
                        <div className="p-4 rounded-2xl border-2 border-[#B94E62] bg-[#FFF8F1] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#B94E62]">
                              Mandatory Manual UPI Advance Payment
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-[#B94E62] text-white text-[10px] font-bold">
                              {cartCalculations.advanceRuleLabel}
                            </span>
                          </div>
                          <p className="text-xs text-[#3B2824]">
                            For <strong>{checkoutFulfilment === 'delivery' ? 'Home Delivery' : 'Takeaway / Parcel'}</strong> orders, an advance payment of{' '}
                            <strong className="font-mono-num text-[#B94E62]">₹{cartCalculations.requiredAdvanceAmount}</strong> is required to confirm your kitchen preparation.
                          </p>
                          <p className="text-[11px] text-[#6B544E]">
                            After clicking <strong>&ldquo;Place Order &amp; Proceed to Advance Payment&rdquo;</strong>, you will see our official UPI QR code &amp; UPI ID (`{paymentSettings.upiId}`) to pay your advance and upload your payment screenshot / UTR for manual verification. The remaining balance of{' '}
                            <strong className="font-mono-num">₹{cartCalculations.remainingBalanceAmount}</strong> is payable upon {checkoutFulfilment === 'delivery' ? 'delivery' : 'store pickup'}.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <label className="p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] flex items-center gap-2 cursor-pointer font-semibold">
                              <input
                                type="radio"
                                name="paymentMethod"
                                checked={checkoutPaymentMethod === 'cod'}
                                onChange={() => setCheckoutPaymentMethod('cod')}
                              />
                              Cash / UPI on Delivery or Pickup
                            </label>
                            <label className="p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] flex items-center gap-2 cursor-pointer font-semibold">
                              <input
                                type="radio"
                                name="paymentMethod"
                                checked={checkoutPaymentMethod === 'pay_at_counter'}
                                onChange={() => setCheckoutPaymentMethod('pay_at_counter')}
                              />
                              Pay at Store Counter
                            </label>
                          </div>
                          {!razorpayConfig.razorpayConfigured && (
                            <p className="text-[11px] text-[#6B544E] mt-1.5">
                              Note: Instant Razorpay online gateway is configurable via server environment secrets; Cash &amp; UPI QR on Delivery/Counter are active.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </form>
                </div>

                {/* Right: Order Price Summary & Coupon Verification */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white border border-[#E6D7C8] rounded-3xl p-6 space-y-5 sticky top-28">
                    <h2 className="font-serif text-2xl font-bold border-b border-[#E6D7C8] pb-3">
                      Order Summary
                    </h2>

                    {/* Coupon Input */}
                    <div>
                      <label className="block text-xs font-semibold text-[#6B544E] mb-1.5">
                        Have a Promotional Code? (Try LOVEYS10 or WELCOME50)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="Enter code"
                          className="flex-1 px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs uppercase font-mono-num"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                      {appliedCouponCode && (
                        <p className="text-xs text-[#2D6A4F] font-semibold mt-1.5">
                          ✓ Coupon {appliedCouponCode} applied (-₹{cartCalculations.discountAmount})
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-xs font-mono-num border-t border-b border-[#E6D7C8] py-4">
                      <div className="flex justify-between">
                        <span className="font-sans text-[#6B544E]">Items Subtotal</span>
                        <span className="font-bold">₹{cartCalculations.subtotal}</span>
                      </div>
                      {cartCalculations.discountAmount > 0 && (
                        <div className="flex justify-between text-[#2D6A4F]">
                          <span className="font-sans">Promotional Discount</span>
                          <span>-₹{cartCalculations.discountAmount}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="font-sans text-[#6B544E]">
                          Delivery Fee ({checkoutFulfilment})
                        </span>
                        <span>
                          {cartCalculations.deliveryFee === 0
                            ? 'FREE'
                            : `₹${cartCalculations.deliveryFee}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-[#6B544E]">Bakery Packaging</span>
                        <span>₹{cartCalculations.packagingCharge}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-[#6B544E]">
                          GST ({settings.taxPercentage}%)
                        </span>
                        <span>₹{cartCalculations.taxAmount}</span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-xl font-bold">Total Order Value</span>
                      <span className="font-serif text-3xl font-bold font-mono-num text-[#3B2824]">
                        ₹{cartCalculations.totalAmount}
                      </span>
                    </div>

                    {cartCalculations.advanceRequired && (
                      <div className="p-4 rounded-2xl bg-[#FFF8F1] border-2 border-[#B94E62] space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#B94E62]">
                            Required Advance Now ({cartCalculations.advanceRuleLabel})
                          </span>
                          <span className="font-mono-num text-lg font-bold text-[#B94E62]">
                            ₹{cartCalculations.requiredAdvanceAmount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#6B544E] pt-1 border-t border-[#E6D7C8]">
                          <span>
                            Remaining Balance ({checkoutFulfilment === 'delivery' ? 'On Delivery' : 'At Pickup'})
                          </span>
                          <span className="font-mono-num font-bold text-[#3B2824]">
                            ₹{cartCalculations.remainingBalanceAmount}
                          </span>
                        </div>
                      </div>
                    )}

                    {checkoutError && (
                      <div className="p-3 rounded-xl bg-[#FFF5F5] border border-[#B94E62] text-xs text-[#B94E62] font-medium">
                        {checkoutError}
                      </div>
                    )}

                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={placingOrder || !cartCalculations.isPinServiceable}
                      className="w-full py-4 rounded-2xl bg-[#B94E62] hover:bg-[#9E3D50] disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
                    >
                      {placingOrder
                        ? 'Creating Order & Advance Invoice...'
                        : cartCalculations.advanceRequired
                        ? `Place Order & Pay ₹${cartCalculations.requiredAdvanceAmount} Advance`
                        : `Confirm & Place Order · ₹${cartCalculations.totalAmount}`}
                    </button>

                    <p className="text-[11px] text-[#6B544E] text-center">
                      {cartCalculations.advanceRequired
                        ? 'Your order will be confirmed immediately once our team verifies your UPI advance payment.'
                        : 'Track your order status live on our website or connect via WhatsApp click-to-chat after confirmation.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : currentPath.startsWith('/order/') ||
          currentPath.startsWith('/payment/') ||
          currentPath === '/track-order' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW D: ORDER CONFIRMATION, ADVANCE PAYMENT & LIVE TRACKER          */
          /* (/order/[id], /payment/[id] & /track-order)                         */
          /* ------------------------------------------------------------------ */
          <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div className="bg-white border border-[#E6D7C8] rounded-3xl p-6 sm:p-10 space-y-6 shadow-xs">
              <div className="text-center space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#B94E62] font-semibold">
                  Real-Time Bakery Order &amp; Advance Payment Portal
                </p>
                <h1 className="font-serif text-3xl sm:text-4xl font-bold">
                  {currentPath.startsWith('/payment/')
                    ? 'Complete Your Advance Payment'
                    : currentPath.startsWith('/order/')
                    ? 'Order Summary & Advance Verification'
                    : 'Track Your Bakery & Pizza Order'}
                </h1>
              </div>

              {/* Search Bar for Order Number */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchOrderSummaryByNumber(trackInputNumber);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={trackInputNumber}
                  onChange={(e) => setTrackInputNumber(e.target.value)}
                  placeholder="Enter Order Number (e.g. LVY-261120-4821)"
                  className="flex-1 px-4 py-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num uppercase"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="px-5 py-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                >
                  {trackLoading ? 'Checking...' : 'Track Status'}
                </button>
              </form>

              {trackError && (
                <div className="p-4 rounded-2xl bg-[#FFF5F5] border border-[#B94E62] text-xs text-[#B94E62]">
                  {trackError}
                </div>
              )}

              {(trackedSummary || latestPlacedOrder) && (
                <div className="space-y-6">
                  {(() => {
                    const ord = trackedSummary || latestPlacedOrder;
                    const matchedFullOrder =
                      latestPlacedOrder && latestPlacedOrder.orderNumber === ord.orderNumber
                        ? latestPlacedOrder
                        : null;
                    return (
                      <>
                        {/* Advance Payment & Verification Workflow Component */}
                        <AdvancePaymentView
                          orderNumber={ord.orderNumber}
                          orderSummary={ord}
                          fullOrder={matchedFullOrder}
                          paymentSettings={paymentSettings}
                          businessSettings={settings}
                          currentUserUid={currentUser?.uid || 'guest'}
                          onOrderUpdated={() => fetchOrderSummaryByNumber(ord.orderNumber)}
                        />

                        {/* Ordered Items & Kitchen Status Card */}
                        <div className="p-6 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D7C8] pb-3">
                            <div>
                              <span className="text-xs text-[#6B544E]">Order Reference</span>
                              <p className="font-mono-num text-xl font-bold text-[#3B2824]">
                                {ord.orderNumber}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-[#6B544E]">Current Kitchen Status</span>
                              <p className="text-sm font-bold uppercase text-[#B94E62]">
                                {String(ord.orderStatus).replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs space-y-1.5">
                            <p>
                              <strong>Fulfilment Mode:</strong>{' '}
                              <span className="uppercase">{ord.fulfilmentType}</span>
                              {ord.tableNumber ? ` (Table ${ord.tableNumber})` : ''}
                            </p>
                            <p className="font-bold pt-1">Ordered Items &amp; Variants:</p>
                            <p className="whitespace-pre-line bg-white p-3 rounded-xl border border-[#E6D7C8]">
                              {ord.itemsSummary}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#E6D7C8]">
                            <span className="text-xs font-semibold">Total Order Amount:</span>
                            <span className="font-mono-num text-lg font-bold">
                              ₹{ord.totalAmount}
                            </span>
                          </div>

                          <div className="pt-3 flex flex-wrap gap-3">
                            <a
                              href={`https://wa.me/${(
                                paymentSettings.verificationWhatsapp || settings.whatsapp
                              ).replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                                `Hello Lovey's Bakery & Pizza Corners! I placed order ${ord.orderNumber} (Total ₹${ord.totalAmount}). Please share an update.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold"
                            >
                              Send Order Details on WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={() => navigate('/menu')}
                              className="px-4 py-2.5 rounded-xl border border-[#3B2824] text-xs font-semibold"
                            >
                              Continue Browsing Menu
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </section>
        ) : currentPath === '/gallery' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW E: DYNAMIC BAKERY GALLERY (/gallery) */
          /* ------------------------------------------------------------------ */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6D7C8] pb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#B94E62] font-semibold mb-1.5">
                  Visual Showcase · Managed via Cloud Storage &amp; Admin Media Library
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl font-bold">
                  Lovey&apos;s Celebration &amp; Bakery Gallery
                </h1>
              </div>
              <button
                type="button"
                onClick={() => navigate('/custom-cake')}
                className="px-5 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold whitespace-nowrap shrink-0"
              >
                Order a Custom Cake Like These
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {mediaAssets
                .filter((m) => m.isVisible !== false)
                .map((asset) => {
                  const srcUrl = asset.imageUrl || asset.url || '';
                  const isVideo = asset.mediaType === 'video' || /\.(mp4|webm|ogg)$/i.test(srcUrl);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setLightboxAsset(asset)}
                      className="group bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#B94E62] transition-all"
                    >
                      <div className="aspect-4/3 overflow-hidden bg-[#F5EBE1] relative">
                        {isVideo ? (
                          <>
                            <video
                              src={srcUrl}
                              preload="metadata"
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <span className="p-3 rounded-full bg-white/90 text-[#3B2824] shadow-md">
                                <Play className="w-5 h-5" />
                              </span>
                            </div>
                          </>
                        ) : (
                          <img
                            src={srcUrl}
                            alt={asset.altText}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        <span className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-4 h-4" />
                        </span>
                      </div>
                      <div className="p-5">
                        <p className="text-[11px] uppercase tracking-wider text-[#B94E62] font-bold">
                          {(asset.section || asset.category || 'Gallery').replace('_', ' ')}
                        </p>
                        <h3 className="font-serif text-xl font-bold text-[#3B2824] mt-0.5">
                          {asset.title}
                        </h3>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ) : currentPath === '/about' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW F: EDITABLE 'OUR STORY' PAGE (/about) */
          /* ------------------------------------------------------------------ */
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
            <div className="bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden shadow-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-5 bg-[#F5EBE1]">
                  <img
                    src="/assets/hero/loveys-hero-spread.jpg"
                    alt="Lovey's Bakery & Pizza Corners Renukoot"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover min-h-[320px]"
                  />
                </div>
                <div className="lg:col-span-7 p-8 sm:p-12 space-y-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#B94E62] font-semibold">
                    Our Story · Renukoot, Sonbhadra
                  </p>
                  <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#3B2824]">
                    Every Treat Has a Little Love in It.
                  </h1>
                  <div className="space-y-4 text-sm text-[#3B2824] leading-relaxed whitespace-pre-line">
                    {settings.ourStoryContent || INITIAL_BUSINESS_SETTINGS.ourStoryContent}
                  </div>
                  <div className="pt-4 border-t border-[#E6D7C8] flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/menu')}
                      className="px-5 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                    >
                      Explore Our Menu
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/custom-cake')}
                      className="px-5 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold"
                    >
                      Design a Custom Cake
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <StoreMapSection
              address={settings.address}
              phone={settings.phone}
              whatsapp={settings.whatsapp}
              openingHours={settings.openingHours}
              googleMapsUrl={settings.googleMapsUrl}
            />
          </section>
        ) : currentPath === '/contact' ? (
          /* ------------------------------------------------------------------ */
          /* VIEW G: CONTACT & INTERACTIVE STORE MAP (/contact) */
          /* ------------------------------------------------------------------ */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#B94E62] font-semibold mb-1.5">
                Find Us in Renukoot, Sonbhadra
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold">
                Visit or Contact Lovey&apos;s Bakery &amp; Pizza Corners
              </h1>
            </div>
            <StoreMapSection
              address={settings.address}
              phone={settings.phone}
              whatsapp={settings.whatsapp}
              openingHours={settings.openingHours}
              googleMapsUrl={settings.googleMapsUrl}
            />
          </section>
        ) : ['/privacy-policy', '/terms', '/delivery-policy', '/cancellation-policy'].includes(
            currentPath
          ) ||
          customPages.some(
            (pg) =>
              pg.isPublished &&
              (pg.slug === currentPath || `/${pg.slug.replace(/^\//, '')}` === currentPath)
          ) ? (
          /* ------------------------------------------------------------------ */
          /* VIEW H: LEGAL, STORE POLICIES & DYNAMIC CMS PAGES */
          /* ------------------------------------------------------------------ */
          <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
            {(() => {
              const matchedPage = customPages.find(
                (pg) =>
                  pg.isPublished &&
                  (pg.slug === currentPath || `/${pg.slug.replace(/^\//, '')}` === currentPath)
              );
              return (
                <div className="bg-white border border-[#E6D7C8] rounded-3xl p-8 sm:p-10 space-y-4">
                  <p className="text-xs uppercase tracking-widest text-[#B94E62] font-semibold">
                    Lovey&apos;s Bakery &amp; Pizza Corners · Official Policy &amp; Information
                  </p>
                  <h1 className="font-serif text-3xl font-bold capitalize">
                    {matchedPage
                      ? matchedPage.title
                      : currentPath.replace('/', '').replace(/-/g, ' ')}
                  </h1>
                  {matchedPage ? (
                    <div className="text-sm text-[#3B2824] leading-relaxed whitespace-pre-line space-y-3">
                      {matchedPage.content}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-[#6B544E] leading-relaxed">
                        Lovey&apos;s Bakery &amp; Pizza Corners (In front of Tiwari Hotel, near Punjab National Bank, Renukoot, Sonbhadra, UP 231217) is committed to fresh daily baking, hygienic packaging, and transparent customer service.
                      </p>
                      <ul className="list-disc pl-5 text-xs text-[#3B2824] space-y-2 leading-relaxed">
                        <li>
                          <strong>Delivery Policy:</strong> Same-day delivery is available across serviceable PIN codes (231217 Renukoot, Hindalco Colony, and Pipri/Murdhawa). Orders above ₹{settings.freeDeliveryThreshold} qualify for free delivery.
                        </li>
                        <li>
                          <strong>Custom Cake Lead Time &amp; Cancellation:</strong> Custom celebration cakes are freshly baked to your specifications. Cancellations or weight modifications must be requested at least 12 hours prior to the scheduled slot by calling +91 80905 29971.
                        </li>
                        <li>
                          <strong>Privacy &amp; Customer Communication:</strong> Customer phone numbers are used strictly for order coordination, live website order tracking, and direct phone or WhatsApp customer support.
                        </li>
                      </ul>
                    </>
                  )}
                </div>
              );
            })()}
          </section>
        ) : currentPath === '/menu' ||
          currentPath === '/cakes' ||
          currentPath.startsWith('/categories/') ? (
          /* ------------------------------------------------------------------ */
          /* VIEW I: EXPLORE MENU & CAKES CATALOGUE (/menu, /cakes, /categories/[slug]) */
          /* ------------------------------------------------------------------ */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E6D7C8] pb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#B94E62] font-semibold mb-1">
                  Freshly Baked Daily in Renukoot
                </p>
                <h1 className="font-serif text-4xl font-bold">
                  {currentPath === '/cakes'
                    ? 'Signature Celebration Cakes'
                    : routeCategorySlug
                    ? categories.find((c) => c.slug === routeCategorySlug)?.name ||
                      'Bakery Catalogue'
                    : 'Explore Our Full Bakery & Pizza Menu'}
                </h1>
              </div>

              {/* Search & Dietary Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6B544E] absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                    placeholder="Search cakes, truffle, pizza..."
                    className="pl-9 pr-4 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs w-56"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFilterEgglessOnly((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    filterEgglessOnly
                      ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                      : 'bg-white text-[#3B2824] border-[#E6D7C8]'
                  }`}
                >
                  100% Eggless Only
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSameDayOnly((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    filterSameDayOnly
                      ? 'bg-[#3B2824] text-[#FFF8F1] border-[#3B2824]'
                      : 'bg-white text-[#3B2824] border-[#E6D7C8]'
                  }`}
                >
                  Same-Day Ready
                </button>
                <select
                  value={menuSortBy}
                  onChange={(e) => setMenuSortBy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-semibold"
                >
                  <option value="popular">Sort: Bestsellers First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Horizontal Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategorySlug('all');
                  if (routeCategorySlug) navigate('/menu');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategorySlug === 'all' && !routeCategorySlug
                    ? 'bg-[#3B2824] text-[#FFF8F1]'
                    : 'bg-white border border-[#E6D7C8] text-[#3B2824]'
                }`}
              >
                All Departments
              </button>
              {categories
                .filter((c) => c.isActive)
                .map((cat) => {
                  const active =
                    routeCategorySlug === cat.slug || selectedCategorySlug === cat.slug;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategorySlug(cat.slug);
                        if (routeCategorySlug) navigate(`/categories/${cat.slug}`);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-[#B94E62] text-white'
                          : 'bg-white border border-[#E6D7C8] text-[#3B2824] hover:bg-[#F5EBE1]'
                      }`}
                    >
                      {lang === 'hi' && cat.nameHi ? cat.nameHi : cat.name}
                    </button>
                  );
                })}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedProducts
                .filter((p) => {
                  const catLabel = p.categoryName || p.categorySlug || '';
                  const descLabel = p.shortDescription || p.description || '';
                  if (currentPath === '/cakes') {
                    return (
                      p.categoryId.includes('cake') ||
                      catLabel.toLowerCase().includes('cake')
                    );
                  }
                  const activeSlug = routeCategorySlug || selectedCategorySlug;
                  if (activeSlug && activeSlug !== 'all') {
                    const matchedCat = categories.find((c) => c.slug === activeSlug);
                    if (matchedCat && p.categoryId !== matchedCat.id) return false;
                  }
                  if (filterEgglessOnly && !p.isEggless) return false;
                  if (filterSameDayOnly && p.sameDayAvailable === false) return false;
                  if (menuSearchQuery.trim()) {
                    const q = menuSearchQuery.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      descLabel.toLowerCase().includes(q) ||
                      catLabel.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .sort((a, b) => {
                  const priceA = a.basePrice ?? a.price ?? 0;
                  const priceB = b.basePrice ?? b.price ?? 0;
                  if (menuSortBy === 'price_asc') return priceA - priceB;
                  if (menuSortBy === 'price_desc') return priceB - priceA;
                  return Number(b.isBestseller) - Number(a.isBestseller);
                })
                .map((prod) => {
                  const sizes = parseVariantOptions(prod.variantsSummary);
                  const flavors = prod.flavorsSummary
                    ? parseVariantOptions(prod.flavorsSummary)
                    : [];
                  const frostings = prod.frostingsSummary
                    ? parseVariantOptions(prod.frostingsSummary)
                    : [];
                  const hasMultiVariants = flavors.length > 0 || frostings.length > 0;
                  const prodBasePrice = prod.basePrice ?? prod.price ?? 0;

                  return (
                    <div
                      key={prod.id}
                      className="group bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-shadow"
                    >
                      <div>
                        <div
                          onClick={() => navigate(`/menu/${prod.slug}`)}
                          className="aspect-4/3 overflow-hidden bg-[#F5EBE1] cursor-pointer relative"
                        >
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="p-5 space-y-2">
                          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#B94E62]">
                            {prod.categoryName || prod.categorySlug} · {prod.isEggless ? '100% Eggless' : 'Artisan'}
                            {prod.isBestseller ? ' · Bestseller' : ''}
                          </p>
                          <h3
                            onClick={() => navigate(`/menu/${prod.slug}`)}
                            className="font-serif text-xl font-bold text-[#3B2824] group-hover:text-[#B94E62] cursor-pointer"
                          >
                            {lang === 'hi' && (prod.nameHi || prod.hindiName)
                              ? prod.nameHi || prod.hindiName
                              : prod.name}
                          </h3>
                          <p className="text-xs text-[#6B544E] line-clamp-2 leading-relaxed">
                            {prod.shortDescription || prod.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-3 border-t border-[#E6D7C8] flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-[#6B544E] block">
                            Starts at ({sizes[0]?.label || 'Base'})
                          </span>
                          <span className="font-serif text-xl font-bold font-mono-num text-[#3B2824]">
                            ₹{prodBasePrice}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/menu/${prod.slug}`)}
                            className="px-3.5 py-2 rounded-xl border border-[#3B2824] text-[#3B2824] text-xs font-semibold hover:bg-[#F5EBE1] whitespace-nowrap"
                          >
                            {hasMultiVariants ? 'Select Size & Flavour' : 'Customize'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              addToCart({
                                cartItemId: `${prod.id}-${Date.now()}`,
                                productId: prod.id,
                                name: prod.name,
                                nameHi: prod.nameHi || prod.hindiName,
                                slug: prod.slug,
                                imageUrl: prod.imageUrl,
                                basePrice: prodBasePrice,
                                selectedSizeLabel: sizes[0]?.label || 'Standard',
                                selectedSizeDelta: sizes[0]?.priceDelta || 0,
                                selectedFlavorLabel: flavors[0]?.label,
                                selectedFlavorDelta: flavors[0]?.priceDelta || 0,
                                selectedFrostingLabel: frostings[0]?.label,
                                selectedFrostingDelta: frostings[0]?.priceDelta || 0,
                                selectedAddons: [],
                                isEggless: prod.isEggless,
                                unitPrice: prodBasePrice,
                                quantity: 1,
                              })
                            }
                            className="p-2.5 rounded-xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] transition-colors"
                            title="Quick Add Default Variant to Cart"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ) : (
          /* ------------------------------------------------------------------ */
          /* VIEW J: COMPLETE HOMEPAGE REDESIGN (SECTIONS A – I) */
          /* ------------------------------------------------------------------ */
          <div className="space-y-24 pb-16">
            {/* ============================================================== */}
            {/* SECTION A — CINEMATIC HERO */}
            {/* ============================================================== */}
            <section className="relative bg-[#1E1412] text-[#FFF8F1] overflow-hidden border-b border-[#3B2824]">
              {/* Oversized Background Editorial Brand Typography */}
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute -top-10 left-1/2 -translate-x-1/2 w-full text-center overflow-hidden opacity-[0.045]"
              >
                <span className="font-serif text-[22vw] font-bold leading-none tracking-tighter text-[#FFF8F1] whitespace-nowrap">
                  LOVEY&apos;S
                </span>
              </div>

              {/* Warm Studio Ambient Glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 75% 35%, rgba(229, 184, 103, 0.2), transparent 55%), radial-gradient(circle at 18% 75%, rgba(185, 78, 98, 0.16), transparent 50%)',
                }}
              />

              <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                {/* Left 6 Columns: Editorial Brand Copy & Primary CTAs */}
                <div className="lg:col-span-6 space-y-7">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.26em] text-[#E5B867] font-semibold">
                      LOVEY&apos;S BAKERY &amp; PIZZA CORNERS · लवी&apos;स बेकरी &amp; पिज्जा कॉर्नर्स
                    </p>
                    <p className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[#E5B867]">
                      LOVEY&apos;S
                    </p>
                  </div>

                  <h1 className="font-serif text-4xl sm:text-6xl lg:text-[4.15rem] font-bold leading-[1.05] tracking-tight text-[#FFF8F1]">
                    {websiteConfig.heroHeading || 'Made to Make Every Moment Sweeter.'}
                  </h1>

                  <p className="text-base sm:text-lg text-[#E6D7C8] leading-relaxed max-w-xl">
                    {websiteConfig.heroSubparagraph ||
                      "From beautiful celebration cakes to your favourite bakery treats, discover something special at Lovey's."}
                  </p>

                  {websiteConfig.promoBannerActive && websiteConfig.promoBannerTitle && (
                    <div className="px-4 py-2.5 rounded-2xl bg-[#2A1C19] border border-[#E5B867]/40 text-xs text-[#E5B867] font-semibold">
                      {websiteConfig.promoBannerTitle}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => navigate(websiteConfig.primaryCtaLink || '/menu')}
                      className="px-7 py-4 rounded-2xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-sm font-semibold transition-all whitespace-nowrap shrink-0 shadow-lg flex items-center gap-2.5"
                    >
                      <span>{websiteConfig.primaryCtaText || 'Explore Our Collection'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(websiteConfig.secondaryCtaLink || '/custom-cake')}
                      className="px-7 py-4 rounded-2xl bg-[#FFF8F1] hover:bg-[#E5B867] text-[#3B2824] text-sm font-semibold transition-all whitespace-nowrap shrink-0"
                    >
                      {websiteConfig.secondaryCtaText || 'Customise Your Cake'}
                    </button>
                  </div>

                  {/* Unboxed Typographic Trust Metadata Row */}
                  <div className="pt-5 border-t border-white/15 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#D7C4B7]">
                    <span className="text-[#E5B867] font-semibold">100% Eggless Celebration Cakes</span>
                    <span>·</span>
                    <span>Stone-Baked Pizzas &amp; Pastries</span>
                    <span>·</span>
                    <span>Renukoot Delivery, Takeaway &amp; Dine-In</span>
                  </div>
                </div>

                {/* Right 6 Columns: Layered 3D-Depth Original Product Photography */}
                <div
                  className="lg:col-span-6 relative"
                  style={{ perspective: '1400px' }}
                >
                  <div className="relative mx-auto max-w-xl">
                    {/* Primary Framed Hero Spread */}
                    <div
                      className="aspect-16/11 rounded-3xl overflow-hidden border-2 border-[#E5B867]/45 shadow-2xl bg-[#2A1C19] transition-transform duration-700 hover:scale-[1.015]"
                      style={{ transform: 'rotateY(-4deg) rotateX(2deg)' }}
                    >
                      <img
                        src={settings.heroBannerUrl || '/assets/hero/loveys-hero-spread.jpg'}
                        alt="Lovey's Bakery & Pizza Corners Celebration Spread"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Foreground Layered Depth Card 1: Tiered Celebration Cake */}
                    <div
                      onClick={() => navigate('/custom-cake')}
                      className="hidden sm:flex items-center gap-3.5 absolute -bottom-7 -left-6 bg-[#281B18]/95 backdrop-blur-md border border-[#E5B867]/50 rounded-2xl p-3 shadow-2xl cursor-pointer hover:border-[#E5B867] transition-all"
                    >
                      <img
                        src="/assets/cakes/loveys-tier-celebration-cake.jpg"
                        alt="Lovey's Signature Celebration Cake"
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#49332E]"
                      />
                      <div className="pr-2">
                        <p className="text-[10px] uppercase tracking-widest text-[#E5B867] font-semibold">
                          Bespoke Cake Studio
                        </p>
                        <p className="font-serif text-sm font-bold text-[#FFF8F1]">
                          Custom Tier &amp; Photo Cakes
                        </p>
                        <p className="text-[11px] text-[#D7C4B7] font-mono-num">
                          1 kg to 5 kg · Select Flavour &rarr;
                        </p>
                      </div>
                    </div>

                    {/* Foreground Layered Depth Card 2: Stone-Baked Pizza Corner */}
                    <div
                      onClick={() => navigate('/menu')}
                      className="hidden sm:flex items-center gap-3.5 absolute -top-6 -right-4 bg-[#281B18]/95 backdrop-blur-md border border-[#49332E] rounded-2xl p-3 shadow-2xl cursor-pointer hover:border-[#B94E62] transition-all"
                    >
                      <img
                        src="/assets/pizza/loveys-stone-baked-pizza.jpg"
                        alt="Lovey's Stone Baked Pizza"
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[#49332E]"
                      />
                      <div className="pr-2">
                        <p className="text-[10px] uppercase tracking-widest text-[#B94E62] font-bold">
                          Pizza Corners
                        </p>
                        <p className="font-serif text-sm font-bold text-[#FFF8F1]">
                          Fresh Oven-Baked Pizzas
                        </p>
                        <p className="text-[11px] text-[#D7C4B7]">
                          Hot Delivery &amp; Dine-In QR
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION B — SCROLL-BASED 3D EXPERIENCE */}
            {/* ============================================================== */}
            <React.Suspense
              fallback={
                <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-[#6B544E]">
                  Loading 3D Photographic Showcase...
                </div>
              }
            >
              <Scroll3DShowcase onNavigate={navigate} />
            </React.Suspense>

            {/* ============================================================== */}
            {/* SECTION C — VISUAL CATEGORY SHOWCASE (EDITORIAL BENTO GRID) */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6D7C8] pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#B94E62] font-semibold mb-1.5">
                    Curated Culinary Departments
                  </p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#3B2824]">
                    Explore by Department
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/menu')}
                  className="text-xs sm:text-sm font-bold text-[#B94E62] hover:underline flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <span>View All {categories.filter((c) => c.isActive).length} Categories</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Asymmetric Editorial Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {categories
                  .filter((c) => c.isActive)
                  .slice(0, 6)
                  .map((cat, idx) => {
                    // Asymmetric spans: first and fourth cards span 7 cols, others span 5 or 4 cols
                    const colSpanClass =
                      idx === 0
                        ? 'md:col-span-7'
                        : idx === 1
                        ? 'md:col-span-5'
                        : idx === 2
                        ? 'md:col-span-4'
                        : idx === 3
                        ? 'md:col-span-4'
                        : 'md:col-span-4';

                    const categoryCount = publishedProducts.filter(
                      (p) => p.categoryId === cat.id || p.categorySlug === cat.slug
                    ).length;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => navigate(`/categories/${cat.slug}`)}
                        className={`${colSpanClass} group relative rounded-3xl overflow-hidden border border-[#E6D7C8] bg-[#281B18] text-left h-72 sm:h-80 shadow-xs hover:shadow-xl transition-all duration-500`}
                      >
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(to top, rgba(24, 15, 13, 0.92) 0%, rgba(24, 15, 13, 0.35) 55%, rgba(24, 15, 13, 0.05) 100%)',
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7 flex flex-col justify-end text-[#FFF8F1]">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[#E5B867] font-semibold">
                            {lang === 'hi' && (cat.nameHi || cat.hindiName)
                              ? cat.nameHi || cat.hindiName
                              : 'Lovey’s Collection'}{' '}
                            {categoryCount > 0 ? `· ${categoryCount} Creations` : ''}
                          </p>
                          <div className="flex items-end justify-between gap-4 mt-1">
                            <div>
                              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#FFF8F1] group-hover:text-[#E5B867] transition-colors">
                                {cat.name}
                              </h3>
                              <p className="text-xs text-[#E6D7C8]/90 line-clamp-1 mt-1 max-w-md">
                                {cat.description}
                              </p>
                            </div>
                            <span className="p-2.5 rounded-xl bg-white/15 group-hover:bg-[#B94E62] text-white transition-colors shrink-0">
                              <ArrowRight className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION D — SIGNATURE CAKE SHOWCASE */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8">
              {(() => {
                const activeDesigns = cakeDesigns.filter((d) => d.isActive);
                const featuredCake =
                  activeDesigns[signatureCakeIdx % Math.max(1, activeDesigns.length)] ||
                  activeDesigns[0];

                if (!featuredCake) return null;

                const cakeTitle = featuredCake.title || featuredCake.name || 'Signature Celebration Cake';
                const cakePrice = featuredCake.startingPrice ?? featuredCake.basePrice ?? 950;
                const cakeWeights =
                  featuredCake.weightsAllowed?.replace(/\|/g, ' · ') ||
                  `${featuredCake.minWeightKg || 1} kg to ${featuredCake.maxWeightKg || 5} kg`;
                const cakeFlavours =
                  featuredCake.availableFlavours ||
                  featuredCake.flavoursAllowed?.replace(/\|/g, ', ') ||
                  'Belgian Chocolate Truffle, Rasmalai, Red Velvet, Fresh Pineapple';

                return (
                  <div className="bg-[#261815] text-[#FFF8F1] rounded-[2rem] border border-[#49332E] overflow-hidden shadow-2xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                      {/* Left 7 Columns: Large Cake Photography & Interactive Design Switcher */}
                      <div className="lg:col-span-7 relative min-h-[380px] sm:min-h-[480px] bg-[#1B110F] overflow-hidden">
                        <img
                          src={featuredCake.imageUrl}
                          alt={cakeTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-all duration-700"
                        />
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(to top, rgba(27, 17, 15, 0.9) 0%, rgba(27, 17, 15, 0.15) 50%, transparent 100%)',
                          }}
                        />

                        {/* Bottom Thumbnail Selector inside Showcase */}
                        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {activeDesigns.map((design, idx) => (
                              <button
                                key={design.id}
                                type="button"
                                onClick={() => setSignatureCakeIdx(idx)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                  idx === signatureCakeIdx % activeDesigns.length
                                    ? 'bg-[#E5B867] text-[#1E1412] font-bold shadow-md'
                                    : 'bg-black/60 text-[#FFF8F1] border border-white/20 hover:bg-black/80'
                                }`}
                              >
                                {design.title || design.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right 5 Columns: Editorial Cake Specifications & CTAs */}
                      <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between space-y-6">
                        <div className="space-y-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-[#E5B867] font-semibold">
                            Signature Cake Showcase · {featuredCake.occasion || featuredCake.theme || 'Bespoke Tiers'}
                          </p>
                          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#FFF8F1] leading-tight">
                            {cakeTitle}
                          </h2>
                          <p className="text-sm text-[#DECBC0] leading-relaxed">
                            {featuredCake.description}
                          </p>

                          <div className="pt-4 border-t border-[#49332E] space-y-3 text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-[#C6B1A3] uppercase tracking-wider">
                                Available Sizes
                              </span>
                              <span className="font-mono-num font-bold text-[#FFF8F1] text-right">
                                {cakeWeights}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#C6B1A3] uppercase tracking-wider">
                                Signature Flavours
                              </span>
                              <span className="font-semibold text-[#E5B867] text-right max-w-xs">
                                {cakeFlavours}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#C6B1A3] uppercase tracking-wider">
                                Starting Price
                              </span>
                              <span className="font-serif text-2xl font-bold font-mono-num text-[#FFF8F1]">
                                ₹{cakePrice}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomOccasion(
                                featuredCake.occasion || featuredCake.theme || 'Birthday Celebration'
                              );
                              setCustomRefImageUrl(featuredCake.imageUrl);
                              setCustomDesignNotes(`Selected Signature Design: ${cakeTitle}`);
                              navigate('/custom-cake');
                            }}
                            className="flex-1 py-3.5 px-6 rounded-2xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs sm:text-sm font-semibold transition-colors text-center whitespace-nowrap"
                          >
                            Customise Cake
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/cakes')}
                            className="py-3.5 px-6 rounded-2xl border border-[#E5B867]/60 hover:bg-[#E5B867] hover:text-[#1E1412] text-[#FFF8F1] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                          >
                            Explore All Cakes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* ============================================================== */}
            {/* SECTION E — BESTSELLER COLLECTION */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6D7C8] pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#B94E62] font-semibold mb-1.5">
                    Customer Favourites · Dynamic Catalogue
                  </p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#3B2824]">
                    Bestseller Collection
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/menu')}
                  className="text-xs sm:text-sm font-bold text-[#3B2824] hover:text-[#B94E62] flex items-center gap-1.5"
                >
                  <span>Browse Full Menu ({publishedProducts.length} Items)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
                {(bestsellerProducts.length > 0 ? bestsellerProducts : publishedProducts)
                  .slice(0, 6)
                  .map((prod) => {
                    const sizes = parseVariantOptions(prod.variantsSummary);
                    const flavors = prod.flavorsSummary
                      ? parseVariantOptions(prod.flavorsSummary)
                      : [];
                    const frostings = prod.frostingsSummary
                      ? parseVariantOptions(prod.frostingsSummary)
                      : [];
                    const prodBasePrice = prod.basePrice ?? prod.price ?? 0;

                    return (
                      <div
                        key={prod.id}
                        className="group bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                      >
                        <div>
                          <div
                            onClick={() => navigate(`/menu/${prod.slug}`)}
                            className="aspect-4/3 overflow-hidden bg-[#F5EBE1] cursor-pointer relative"
                          >
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          <div className="p-6 space-y-2.5">
                            {/* Unboxed Metadata Line */}
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-[#B94E62]">
                              {prod.categoryName || prod.categorySlug} ·{' '}
                              {prod.isEggless ? '100% Eggless' : 'Artisan'} ·{' '}
                              {prod.isAvailable ? 'In Stock' : 'Sold Out'}
                            </p>

                            <h3
                              onClick={() => navigate(`/menu/${prod.slug}`)}
                              className="font-serif text-xl sm:text-2xl font-bold text-[#3B2824] group-hover:text-[#B94E62] cursor-pointer transition-colors"
                            >
                              {lang === 'hi' && (prod.nameHi || prod.hindiName)
                                ? prod.nameHi || prod.hindiName
                                : prod.name}
                            </h3>

                            <p className="text-xs text-[#6B544E] line-clamp-2 leading-relaxed">
                              {prod.shortDescription || prod.description}
                            </p>

                            {/* Available Variants Summary */}
                            <p className="text-[11px] text-[#6B544E] pt-1 font-mono-num">
                              <strong className="font-sans text-[#3B2824]">Sizes:</strong>{' '}
                              {sizes.map((s) => s.label).join(' · ')}
                            </p>
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-4 border-t border-[#E6D7C8] flex items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[#6B544E] block">
                              {sizes[0]?.label || 'Base'}
                            </span>
                            <span className="font-serif text-2xl font-bold font-mono-num text-[#3B2824]">
                              ₹{prodBasePrice}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/menu/${prod.slug}`)}
                              className="px-3.5 py-2.5 rounded-xl border border-[#3B2824] text-[#3B2824] text-xs font-semibold hover:bg-[#F5EBE1] transition-colors"
                            >
                              Options
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                addToCart({
                                  cartItemId: `${prod.id}-${Date.now()}`,
                                  productId: prod.id,
                                  name: prod.name,
                                  nameHi: prod.nameHi || prod.hindiName,
                                  slug: prod.slug,
                                  imageUrl: prod.imageUrl,
                                  basePrice: prodBasePrice,
                                  selectedSizeLabel: sizes[0]?.label || 'Standard',
                                  selectedSizeDelta: sizes[0]?.priceDelta || 0,
                                  selectedFlavorLabel: flavors[0]?.label,
                                  selectedFlavorDelta: flavors[0]?.priceDelta || 0,
                                  selectedFrostingLabel: frostings[0]?.label,
                                  selectedFrostingDelta: frostings[0]?.priceDelta || 0,
                                  selectedAddons: [],
                                  isEggless: prod.isEggless,
                                  unitPrice: prodBasePrice,
                                  quantity: 1,
                                })
                              }
                              className="px-4 py-2.5 rounded-xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs font-semibold transition-colors"
                            >
                              Add to Cart
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION F — BRAND STORY ("Every Treat Has a Little Love in It.") */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8">
              <div className="bg-white border border-[#E6D7C8] rounded-[2rem] p-8 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center shadow-xs">
                {/* Left 6 Columns: Layered Original Bakery Photographs */}
                <div className="lg:col-span-6 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-7 rounded-3xl overflow-hidden border border-[#E6D7C8] shadow-md aspect-4/5 bg-[#F5EBE1]">
                    <img
                      src="/assets/store/loveys-bakery-table.jpg"
                      alt="Lovey's Bakery & Pizza Corners Artisanal Table"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="col-span-5 space-y-4">
                    <div className="rounded-2xl overflow-hidden border border-[#E6D7C8] shadow-sm aspect-square bg-[#F5EBE1]">
                      <img
                        src="/assets/cakes/loveys-chocolate-truffle-gateau.jpg"
                        alt="Lovey's Signature Chocolate Truffle Gateau"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] text-xs space-y-1">
                      <p className="font-serif text-base font-bold text-[#3B2824]">
                        Renukoot, Sonbhadra
                      </p>
                      <p className="text-[#6B544E] leading-relaxed">
                        In front of Tiwari Hotel, near Punjab National Bank (UP 231217)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right 6 Columns: Editable Narrative Content */}
                <div className="lg:col-span-6 space-y-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#B94E62] font-semibold">
                    Our Story · Crafted for Celebrations &amp; Everyday Cravings
                  </p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#3B2824] leading-tight">
                    Every Treat Has a Little Love in It.
                  </h2>
                  <div className="text-sm text-[#6B544E] leading-relaxed whitespace-pre-line space-y-3">
                    {settings.ourStoryContent || INITIAL_BUSINESS_SETTINGS.ourStoryContent}
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => navigate('/about')}
                      className="px-6 py-3.5 rounded-2xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs sm:text-sm font-semibold transition-colors"
                    >
                      Read Full Brand Story
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/custom-cake')}
                      className="px-6 py-3.5 rounded-2xl border border-[#3B2824] hover:bg-[#F5EBE1] text-[#3B2824] text-xs sm:text-sm font-semibold transition-colors"
                    >
                      Design a Celebration Cake
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION G — FOOD & BAKERY EXPERIENCE */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E6D7C8] pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#B94E62] font-semibold mb-1.5">
                    One Destination · Sweet Patisserie &amp; Savoury Café
                  </p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#3B2824]">
                    From Patisserie Counter to Stone Pizza Ovens
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/menu')}
                  className="px-6 py-3.5 rounded-2xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 self-start md:self-auto whitespace-nowrap"
                >
                  <span>Explore Full Menu</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pillar 1: Celebration Cakes & Custom Tiers */}
                <div className="bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs">
                  <div className="aspect-16/10 overflow-hidden bg-[#F5EBE1]">
                    <img
                      src="/assets/cakes/loveys-tier-celebration-cake.jpg"
                      alt="Celebration & Custom Cakes"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 space-y-3">
                    <p className="text-[11px] uppercase tracking-widest text-[#B94E62] font-bold">
                      01 · Celebration Patisserie
                    </p>
                    <h3 className="font-serif text-2xl font-bold text-[#3B2824]">
                      100% Eggless Cakes &amp; Gateaux
                    </h3>
                    <p className="text-xs text-[#6B544E] leading-relaxed">
                      Belgian chocolate truffle, pistachio rasmalai fusion, crimson red velvet, and multi-tier birthday or anniversary centrepieces.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/cakes')}
                      className="pt-2 text-xs font-bold text-[#B94E62] hover:underline flex items-center gap-1"
                    >
                      <span>Browse Cakes Collection</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pillar 2: Bakery Treats, Pastries & Desserts */}
                <div className="bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs">
                  <div className="aspect-16/10 overflow-hidden bg-[#F5EBE1]">
                    <img
                      src="/assets/bakery/loveys-pastries-cookies.jpg"
                      alt="Bakery Pastries & Desserts"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 space-y-3">
                    <p className="text-[11px] uppercase tracking-widest text-[#B94E62] font-bold">
                      02 · Bakery &amp; Dessert Bar
                    </p>
                    <h3 className="font-serif text-2xl font-bold text-[#3B2824]">
                      Pastries, Cupcakes, Brownies &amp; Waffles
                    </h3>
                    <p className="text-xs text-[#6B544E] leading-relaxed">
                      Individual pastry slices, swirled cupcakes, warm walnut fudge brownies, crispy Belgian waffles, and artisanal cookies.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/categories/pastries')}
                      className="pt-2 text-xs font-bold text-[#B94E62] hover:underline flex items-center gap-1"
                    >
                      <span>Explore Bakery Treats</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pillar 3: Stone-Baked Pizzas & Savoury Café */}
                <div className="bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xs">
                  <div className="aspect-16/10 overflow-hidden bg-[#F5EBE1]">
                    <img
                      src="/assets/pizza/loveys-stone-baked-pizza.jpg"
                      alt="Lovey's Pizza Corners"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 space-y-3">
                    <p className="text-[11px] uppercase tracking-widest text-[#B94E62] font-bold">
                      03 · The Pizza Corners
                    </p>
                    <h3 className="font-serif text-2xl font-bold text-[#3B2824]">
                      Oven-Fresh Pizzas, Garlic Bread &amp; Burgers
                    </h3>
                    <p className="text-xs text-[#6B544E] leading-relaxed">
                      Hand-stretched Tandoori Paneer Tikka and Farmhouse pizzas, cheese-pull stuffed garlic bread, cafe burgers, and thick cold coffee.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/categories/pizzas')}
                      className="pt-2 text-xs font-bold text-[#B94E62] hover:underline flex items-center gap-1"
                    >
                      <span>Order Pizzas &amp; Savouries</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION H — GALLERY (WITH LIGHTBOX VIEWING & VIDEO SUPPORT) */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6D7C8] pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#B94E62] font-semibold mb-1.5">
                    Authentic Visual Portfolio · Click Any Frame to Enlarge
                  </p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#3B2824]">
                    From Our Bakery &amp; Celebration Gallery
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/gallery')}
                  className="text-xs sm:text-sm font-bold text-[#B94E62] hover:underline flex items-center gap-1.5"
                >
                  <span>Open Full Gallery</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {mediaAssets
                  .filter((m) => m.isVisible !== false)
                  .slice(0, 6)
                  .map((asset) => {
                    const srcUrl = asset.imageUrl || asset.url || '';
                    const isVideo =
                      asset.mediaType === 'video' || /\.(mp4|webm|ogg)$/i.test(srcUrl);

                    return (
                      <div
                        key={asset.id}
                        onClick={() => setLightboxAsset(asset)}
                        className="group relative bg-white border border-[#E6D7C8] rounded-3xl overflow-hidden shadow-2xs hover:shadow-xl cursor-pointer transition-all"
                      >
                        <div className="aspect-4/3 overflow-hidden bg-[#F5EBE1] relative">
                          {isVideo ? (
                            <>
                              <video
                                src={srcUrl}
                                preload="metadata"
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                <span className="p-3.5 rounded-full bg-white/90 text-[#3B2824] shadow-lg">
                                  <Play className="w-5 h-5" />
                                </span>
                              </div>
                            </>
                          ) : (
                            <img
                              src={srcUrl}
                              alt={asset.altText || asset.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-85 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-3 text-white">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-[#E5B867] font-semibold">
                                {(asset.section || asset.category || 'Gallery').replace('_', ' ')}
                              </p>
                              <h3 className="font-serif text-lg sm:text-xl font-bold mt-0.5">
                                {asset.title}
                              </h3>
                            </div>
                            <span className="p-2 rounded-xl bg-white/15 backdrop-blur-xs text-white shrink-0">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* ============================================================== */}
            {/* SECTION I — LOCATION & CONTACT */}
            {/* ============================================================== */}
            <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-10">
              <StoreMapSection
                address={settings.address}
                phone={settings.phone}
                whatsapp={settings.whatsapp}
                openingHours={settings.openingHours}
                googleMapsUrl={settings.googleMapsUrl}
              />

              {/* Final Call-to-Action Banner */}
              <div className="bg-[#3B2824] text-[#FFF8F1] rounded-3xl p-8 sm:p-12 border border-[#49332E] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#E5B867] font-semibold">
                    Ready to Celebrate in Renukoot?
                  </p>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold">
                    Order Online for Doorstep Delivery, Store Pickup, or Dine-In Table Service.
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('/menu')}
                    className="px-6 py-3.5 rounded-2xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    Order from Menu
                  </button>
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                      "Hello Lovey's Bakery & Pizza Corners! I would like to place an order."
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 rounded-2xl bg-[#2D6A4F] hover:bg-[#23533D] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Click-to-Chat</span>
                  </a>
                  <a
                    href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                    className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-[#FFF8F1] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors font-mono-num"
                  >
                    <Phone className="w-4 h-4 text-[#E5B867]" />
                    <span>{settings.phone}</span>
                  </a>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Cart Bar (<= 15% viewport height, hidden on cart/checkout) */}
      {cartTotalCount > 0 && currentPath !== '/cart' && currentPath !== '/checkout' && (
        <div className="sm:hidden sticky bottom-0 z-40 bg-[#1E1412] text-[#FFF8F1] border-t border-[#49332E] px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
          <div>
            <p className="text-[11px] text-[#E5B867] font-semibold">
              {cartTotalCount} {cartTotalCount === 1 ? 'Item' : 'Items'} in Cart
            </p>
            <p className="font-mono-num text-sm font-bold">
              Subtotal: ₹{cartCalculations.subtotal}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="px-5 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <span>Proceed to Cart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION J — FOOTER */}
      {/* ==================================================================== */}
      <footer className="bg-[#1E1412] text-[#FFF8F1] border-t border-[#3B2824] mt-16">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Col 1: Brand Identity & Address */}
          <div className="lg:col-span-4 space-y-3.5">
            <p className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#FFF8F1]">
              LOVEY&apos;S BAKERY &amp; PIZZA CORNERS
            </p>
            <p className="text-xs text-[#E5B867] font-semibold">
              लवी&apos;स बेकरी &amp; पिज्जा कॉर्नर्स · Made to Make Every Moment Sweeter.
            </p>
            <p className="text-xs text-[#D7C4B7] leading-relaxed">
              {settings.address}
            </p>
            <div className="pt-1 space-y-1 text-xs font-mono-num text-[#E5B867]">
              <p>
                Phone / WhatsApp:{' '}
                <a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="hover:underline">
                  {settings.phone}
                </a>
              </p>
              <p className="font-sans text-[#C6B1A3]">{settings.openingHours}</p>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="lg:col-span-2 space-y-2.5 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#E5B867] mb-2">
              Quick Links
            </p>
            {[
              { path: '/', label: 'Home' },
              { path: '/menu', label: 'Explore Full Menu' },
              { path: '/cakes', label: 'Celebration Cakes' },
              { path: '/custom-cake', label: 'Custom Cake Studio' },
              { path: '/gallery', label: 'Photo & Video Gallery' },
              { path: '/about', label: 'Our Story' },
              { path: '/track-order', label: 'Track Your Order' },
              { path: '/contact', label: 'Location & Contact' },
            ].map((l) => (
              <button
                key={l.path}
                type="button"
                onClick={() => navigate(l.path)}
                className="block text-[#D7C4B7] hover:text-white transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Col 3: Menu Categories */}
          <div className="lg:col-span-3 space-y-2.5 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#E5B867] mb-2">
              Menu Categories
            </p>
            {categories
              .filter((c) => c.isActive)
              .slice(0, 7)
              .map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/categories/${cat.slug}`)}
                  className="block text-[#D7C4B7] hover:text-white transition-colors text-left"
                >
                  {cat.name}
                </button>
              ))}
          </div>

          {/* Col 4: Social Media, Policies & Admin Portal */}
          <div className="lg:col-span-3 space-y-3 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#E5B867]">
              Connect &amp; Policies
            </p>
            <div className="space-y-2">
              <a
                href={settings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[#D7C4B7] hover:text-white"
              >
                <MapPin className="w-3.5 h-3.5 text-[#E5B867]" />
                <span>Google Maps Official Listing</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              <a
                href={settings.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[#D7C4B7] hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#E5B867]" />
                <span>Official Facebook Page</span>
              </a>
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[#D7C4B7] hover:text-white"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>WhatsApp Direct Chat</span>
              </a>
            </div>

            <div className="pt-3 border-t border-[#3B2824] space-y-1.5">
              {[
                { path: '/delivery-policy', label: 'Delivery & PIN Zones Policy' },
                { path: '/cancellation-policy', label: 'Cancellation & Refund Policy' },
                { path: '/privacy-policy', label: 'Privacy Policy' },
                { path: '/terms', label: 'Terms of Service' },
                { path: '/admin/login', label: 'Business Admin / Staff Login' },
              ].map((l) => (
                <button
                  key={l.path}
                  type="button"
                  onClick={() => navigate(l.path)}
                  className="block text-[#C6B1A3] hover:text-white transition-colors"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#3B2824] px-4 sm:px-8 py-5 text-center text-xs text-[#C6B1A3]">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              &copy; {new Date().getFullYear()} Lovey&apos;s Bakery &amp; Pizza Corners (लवी&apos;स बेकरी &amp; पिज्जा कॉर्नर्स), Renukoot, Sonbhadra, UP 231217. All rights reserved.
            </p>
            <p className="text-[11px] text-[#E5B867]">
              100% Eggless Celebration Cakes · Fresh Bakery · Stone-Baked Pizzas
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

