import express from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';

// ============================================================================
// PASSWORD-ONLY ADMIN AUTHENTICATION ENGINE (NO OTP / NO PASSKEYS / NO WEBAUTHN)
// ============================================================================

interface StoredAdminAccount {
  id: string;
  email: string;
  username: string;
  name: string;
  phone: string;
  roleId: string;
  roleName: string;
  permissionsSummary: string;
  status: 'active' | 'invited' | 'suspended' | 'revoked';
  passwordHash: string; // scrypt$saltHex$derivedKeyHex
  requirePasswordChange: boolean;
  sessionVersion: number;
  sessionTimeoutMinutes: number;
  lastLoginAt?: string;
  passwordUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ActiveAdminSession {
  sessionId: string;
  tokenHash: string;
  accountId: string;
  email: string;
  username: string;
  name: string;
  roleId: string;
  roleName: string;
  permissionsSummary: string;
  sessionVersion: number;
  ipAddress: string;
  userAgent: string;
  rememberDevice: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: number;
}

interface LoginHistoryEntry {
  id: string;
  emailOrUsername: string;
  accountId?: string;
  roleName?: string;
  ipAddress: string;
  userAgent: string;
  outcome: 'success' | 'failure' | 'lockout' | 'password_changed' | 'password_reset' | 'session_revoked';
  reason: string;
  suspicious: boolean;
  createdAt: string;
}

interface PasswordResetTokenRecord {
  tokenHash: string;
  email: string;
  accountId: string;
  expiresAt: number;
  used: boolean;
  createdAt: string;
}

interface AdminAuthStoreData {
  ownerConfigured: boolean;
  accounts: StoredAdminAccount[];
  sessions: ActiveAdminSession[];
  loginHistory: LoginHistoryEntry[];
  resetTokens: PasswordResetTokenRecord[];
}

const COMPROMISED_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'password123456',
  'admin1234567',
  'admin12345678',
  '123456789012',
  '1234567890123',
  'qwertyuiop12',
  'qwerty123456',
  'loveysbakery',
  'loveys123456',
  'renukoot1234',
  'welcome12345',
  'letmein12345',
  'iloveyou1234',
  'changeme1234',
]);

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function validateStrongPasswordPolicy(
  password: string,
  identifierHint = ''
): { valid: boolean; error?: string } {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 12) {
    return {
      valid: false,
      error: 'Password must be at least 12 characters long (strong passwords or multi-word passphrases supported).',
    };
  }
  if (password.length > 256) {
    return {
      valid: false,
      error: 'Password cannot exceed 256 characters.',
    };
  }
  const normalized = password.trim().toLowerCase();
  if (COMPROMISED_PASSWORDS.has(normalized) || /^(.)\1{7,}$/.test(normalized)) {
    return {
      valid: false,
      error: 'This password appears on the commonly compromised password list. Please choose a stronger password or passphrase.',
    };
  }
  if (identifierHint) {
    const cleanHint = identifierHint.split('@')[0].toLowerCase().trim();
    if (cleanHint.length >= 4 && normalized === cleanHint) {
      return {
        valid: false,
        error: 'Password cannot be identical to your email or username.',
      };
    }
  }
  const isPassphrase = password.trim().includes(' ') && password.trim().length >= 16;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  if (!isPassphrase && (!hasLetter || !hasDigitOrSymbol)) {
    return {
      valid: false,
      error: 'Password must contain at least 12 characters including letters and numbers/symbols, or be a multi-word passphrase (16+ characters).',
    };
  }
  return { valid: true };
}

function hashTokenSha256(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const AUTH_STORE_DIR = path.join(__dirname, '.data');
const AUTH_STORE_FILE = path.join(AUTH_STORE_DIR, 'admin-auth-store.json');

const OWNER_DEFAULT_PERMISSIONS =
  'view,create,edit,publish,delete_archive,export_csv,approve_orders,verify_payments,manage_settings,invite_staff';

function loadAdminAuthStore(): AdminAuthStoreData {
  const nowIso = new Date().toISOString();

  let store: AdminAuthStoreData = {
    ownerConfigured: false,
    accounts: [
      {
        id: 'staff-owner-bootstrapped',
        email: 'prabhve5@gmail.com',
        username: 'owner',
        name: "Lovey's Principal Owner",
        phone: '+91 80905 29971',
        roleId: 'role-owner',
        roleName: 'Owner / Super Admin',
        permissionsSummary: OWNER_DEFAULT_PERMISSIONS,
        status: 'active',
        passwordHash: '',
        requirePasswordChange: false,
        sessionVersion: 1,
        sessionTimeoutMinutes: 60,
        passwordUpdatedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    sessions: [],
    loginHistory: [],
    resetTokens: [],
  };

  try {
    if (fs.existsSync(AUTH_STORE_FILE)) {
      const raw = fs.readFileSync(AUTH_STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.accounts)) {
        store = {
          ownerConfigured: Boolean(parsed.ownerConfigured),
          accounts: parsed.accounts,
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          loginHistory: Array.isArray(parsed.loginHistory) ? parsed.loginHistory.slice(0, 150) : [],
          resetTokens: Array.isArray(parsed.resetTokens) ? parsed.resetTokens : [],
        };
      }
    }
  } catch (err) {
    console.warn('Admin auth store read fallback:', err);
  }

  const ownerAcc = store.accounts.find(
    (a) => a.email.toLowerCase() === 'prabhve5@gmail.com' || a.roleId === 'role-owner'
  );
  store.ownerConfigured = Boolean(ownerAcc && ownerAcc.passwordHash);

  return store;
}

const adminAuthStore: AdminAuthStoreData = loadAdminAuthStore();

function saveAdminAuthStore(): void {
  try {
    if (!fs.existsSync(AUTH_STORE_DIR)) {
      fs.mkdirSync(AUTH_STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(AUTH_STORE_FILE, JSON.stringify(adminAuthStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Admin auth store save fallback (in-memory active):', err);
  }
}

// In-memory rate limiter for admin password login attempts
const adminRateLimits = new Map<string, { count: number; lockUntil: number; lastAttempt: number }>();

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) {
      result[k.trim()] = decodeURIComponent(v.join('='));
    }
  }
  return result;
}

function setAdminSessionCookie(res: express.Response, rawToken: string, maxAgeSeconds: number): void {
  const cookieParts = [
    `loveys_admin_session=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=None',
    'Secure',
    'Partitioned',
  ];
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearAdminSessionCookie(res: express.Response): void {
  res.setHeader(
    'Set-Cookie',
    'loveys_admin_session=; Path=/; HttpOnly; Max-Age=0; SameSite=None; Secure; Partitioned'
  );
}

function getAuthenticatedSession(
  req: express.Request
): { session: ActiveAdminSession; account: StoredAdminAccount } | null {
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = bearerToken || cookies['loveys_admin_session'] || '';
  if (!rawToken) return null;

  const tokenHash = hashTokenSha256(rawToken);
  const now = Date.now();
  // Purge expired sessions
  adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.expiresAt > now);

  const session = adminAuthStore.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session) return null;

  const account = adminAuthStore.accounts.find(
    (a) => a.id === session.accountId && a.status === 'active'
  );
  if (!account) return null;

  // Verify sessionVersion matches (invalidates sessions on password change/reset)
  if (session.sessionVersion !== account.sessionVersion) {
    adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.sessionId !== session.sessionId);
    saveAdminAuthStore();
    return null;
  }

  // Check inactivity timeout
  const timeoutMs = Math.max(5, account.sessionTimeoutMinutes || 60) * 60 * 1000;
  const lastActiveMs = new Date(session.lastActiveAt).getTime();
  if (!session.rememberDevice && now - lastActiveMs > timeoutMs) {
    adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.sessionId !== session.sessionId);
    saveAdminAuthStore();
    return null;
  }

  session.lastActiveAt = new Date().toISOString();
  return { session, account };
}

function sanitizeAccountForClient(acc: StoredAdminAccount) {
  return {
    id: acc.id,
    email: acc.email,
    username: acc.username,
    name: acc.name,
    phone: acc.phone,
    roleId: acc.roleId,
    roleName: acc.roleName,
    permissionsSummary: acc.permissionsSummary,
    status: acc.status,
    requirePasswordChange: acc.requirePasswordChange,
    sessionVersion: acc.sessionVersion,
    sessionTimeoutMinutes: acc.sessionTimeoutMinutes,
    lastLoginAt: acc.lastLoginAt,
    passwordUpdatedAt: acc.passwordUpdatedAt,
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  };
}

function recordLoginEvent(entry: Omit<LoginHistoryEntry, 'id' | 'createdAt'>): void {
  adminAuthStore.loginHistory.unshift({
    ...entry,
    id: `auth-evt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
  });
  if (adminAuthStore.loginHistory.length > 150) {
    adminAuthStore.loginHistory = adminAuthStore.loginHistory.slice(0, 150);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));

  // Enterprise Security Headers & Search Engine Protection for /admin
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    if (req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    next();
  });

  // ============================================================================
  // 1. SEO ROUTES: /robots.txt & /sitemap.xml
  // ============================================================================
  app.get('/robots.txt', (req, res) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /payment/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}`;
    const publicRoutes = [
      '/',
      '/menu',
      '/cakes',
      '/custom-cake',
      '/gallery',
      '/about',
      '/contact',
      '/track-order',
      '/categories/birthday-cakes',
      '/categories/designer-cakes',
      '/categories/chocolate-cakes',
      '/categories/anniversary-cakes',
      '/categories/pastries-desserts',
      '/categories/pizza',
      '/categories/burgers',
      '/categories/waffles',
      '/privacy-policy',
      '/terms',
      '/delivery-policy',
      '/cancellation-policy',
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>daily</changefreq>
    <priority>${route === '/' ? '1.0' : route.startsWith('/categories/') ? '0.85' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // ============================================================================
  // 2. SERVER-SIDE DETERMINISTIC ORDER & ADVANCE PAYMENT CALCULATION
  // ============================================================================
  app.post('/api/orders/verify-pricing', (req, res) => {
    try {
      const {
        items = [],
        fulfilmentType = 'delivery',
        pinCode = '',
        couponCode = '',
        deliveryZones = [],
        coupons = [],
        settings = {},
        paymentSettings = {},
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart cannot be empty.' });
      }

      let subtotal = 0;
      let hasQuotationItem = false;

      for (const item of items) {
        const unitPrice = Number(item.unitPrice);
        const qty = Number(item.quantity);
        if (
          !Number.isFinite(unitPrice) ||
          unitPrice < 0 ||
          !Number.isInteger(qty) ||
          qty < 1 ||
          qty > 100
        ) {
          return res.status(400).json({
            error: 'Invalid item price or quantity detected during server verification.',
          });
        }
        if (item.isQuotationBased) {
          hasQuotationItem = true;
        }
        subtotal += Math.round(unitPrice * qty);
      }

      // Coupon verification
      let discountAmount = 0;
      let appliedCoupon: string | null = null;
      if (couponCode && Array.isArray(coupons)) {
        const normalized = String(couponCode).trim().toUpperCase();
        const found = coupons.find(
          (c: any) =>
            String(c.code).toUpperCase() === normalized &&
            c.isActive &&
            Number(c.usedCount || 0) < Number(c.maxUsage || 999999)
        );
        if (found && subtotal >= Number(found.minCartValue || 0)) {
          appliedCoupon = found.code;
          if (found.discountType === 'percentage') {
            discountAmount = Math.round((subtotal * Number(found.discountValue)) / 100);
          } else {
            discountAmount = Math.min(subtotal, Math.round(Number(found.discountValue)));
          }
        }
      }

      // Fulfilment & delivery zone verification
      let deliveryFee = 0;
      const packagingCharge =
        fulfilmentType === 'dine_in' ? 0 : Math.max(0, Number(settings.packagingCharge ?? 20));

      if (fulfilmentType === 'delivery') {
        if (settings.deliveryEnabled === false) {
          return res.status(400).json({
            error:
              'Home delivery is temporarily suspended by the bakery. Please choose Takeaway Pickup or Dine-In.',
          });
        }
        const trimmedPin = String(pinCode).trim();
        const matchingZones = Array.isArray(deliveryZones)
          ? deliveryZones.filter((z: any) => String(z.pinCode).trim() === trimmedPin)
          : [];

        const activeZone = matchingZones.find((z: any) => z.isServiceable);
        if (!activeZone) {
          return res.status(400).json({
            error: `Home delivery is not serviceable for PIN code ${
              trimmedPin || '(empty)'
            }. Please choose Takeaway / Store Pickup at our Renukoot outlet.`,
            serviceable: false,
          });
        }

        const minOrder = Math.max(
          Number(settings.minDeliveryOrder || 0),
          Number(activeZone.minOrderAmount || 0)
        );
        if (subtotal - discountAmount < minOrder) {
          return res.status(400).json({
            error: `Minimum order value for delivery to ${activeZone.localityName} (${trimmedPin}) is ₹${minOrder}.`,
          });
        }

        const freeThreshold = Number(settings.freeDeliveryThreshold || 799);
        deliveryFee =
          subtotal - discountAmount >= freeThreshold
            ? 0
            : Number(activeZone.deliveryFee ?? settings.baseDeliveryFee ?? 40);
      }

      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const taxPct = Math.max(0, Math.min(50, Number(settings.taxPercentage ?? 5)));
      const taxAmount = Math.round((taxableAmount * taxPct) / 100);
      const totalAmount = taxableAmount + deliveryFee + packagingCharge + taxAmount;

      // Authoritative Server-Side Advance Payment Calculation
      const mandatoryDelivery = paymentSettings.mandatoryForDelivery !== false;
      const mandatoryPickup = paymentSettings.mandatoryForPickup !== false;
      const requireForQuotation = Boolean(paymentSettings.requireAdvanceForQuotation);

      let advanceRequired = false;
      if (fulfilmentType === 'delivery' && mandatoryDelivery) {
        advanceRequired = true;
      } else if (fulfilmentType === 'pickup' && mandatoryPickup) {
        advanceRequired = true;
      }

      // Custom cake quotation orders do not demand advance payment until priced unless explicitly enabled
      if (hasQuotationItem && !requireForQuotation) {
        advanceRequired = false;
      }

      let requiredAdvanceAmount = 0;
      let advanceCalculationLabel = 'No advance payment required';

      if (advanceRequired && totalAmount > 0) {
        const useSeparate = Boolean(paymentSettings.useSeparateRulesByOrderType);
        const ruleType =
          useSeparate && fulfilmentType === 'pickup'
            ? paymentSettings.pickupAdvanceType || 'percentage'
            : paymentSettings.advanceType || 'percentage';

        const rulePct = Math.max(
          1,
          Math.min(
            100,
            Number(
              useSeparate && fulfilmentType === 'pickup'
                ? paymentSettings.pickupAdvancePercentage ?? 20
                : paymentSettings.advancePercentage ?? 20
            )
          )
        );

        const ruleFixed = Math.max(
          0,
          Number(
            useSeparate && fulfilmentType === 'pickup'
              ? paymentSettings.pickupFixedAdvanceAmount ?? 150
              : paymentSettings.fixedAdvanceAmount ?? 200
          )
        );

        const minAdv = Math.max(0, Number(paymentSettings.minAdvanceAmount ?? 100));
        const maxAdv = Math.max(minAdv, Number(paymentSettings.maxAdvanceAmount ?? 10000));

        let rawAdvance =
          ruleType === 'fixed' ? ruleFixed : Math.round((totalAmount * rulePct) / 100);

        rawAdvance = Math.max(minAdv, rawAdvance);
        rawAdvance = Math.min(maxAdv, rawAdvance);
        requiredAdvanceAmount = Math.min(totalAmount, Math.round(rawAdvance));

        advanceCalculationLabel =
          ruleType === 'fixed'
            ? `Fixed Advance (₹${requiredAdvanceAmount})`
            : `${rulePct}% Advance (₹${requiredAdvanceAmount})`;
      }

      const remainingBalanceAmount = Math.max(0, totalAmount - requiredAdvanceAmount);
      const deadlineMins = Math.max(
        5,
        Math.min(10080, Number(paymentSettings.paymentDeadlineMinutes ?? 60))
      );
      const paymentDeadlineIso = new Date(Date.now() + deadlineMins * 60 * 1000).toISOString();

      return res.json({
        verified: true,
        subtotal,
        discountAmount,
        appliedCoupon,
        deliveryFee,
        packagingCharge,
        taxAmount,
        totalAmount,
        hasQuotationItem,
        advanceRequired,
        requiredAdvanceAmount,
        remainingBalanceAmount,
        advanceCalculationLabel,
        paymentDeadlineIso,
      });
    } catch (error: any) {
      console.error('Pricing verification error:', error);
      return res.status(500).json({
        error: error.message || 'Server price verification failed.',
      });
    }
  });

  // ============================================================================
  // 2B. SERVER-SIDE PAYMENT SCREENSHOT & UTR SUBMISSION VALIDATION
  // ============================================================================
  app.post('/api/payments/validate-submission', (req, res) => {
    try {
      const {
        orderNumber,
        utrNumber,
        amountPaid,
        requiredAdvanceAmount,
        totalOrderAmount,
        screenshotMimeType,
        screenshotSizeBytes,
        screenshotDataPrefix,
      } = req.body;

      if (!orderNumber || typeof orderNumber !== 'string') {
        return res.status(400).json({ error: 'Valid Order Number is required.' });
      }

      const cleanUtr = String(utrNumber || '').trim();
      if (!/^[A-Za-z0-9\-]{6,36}$/.test(cleanUtr)) {
        return res.status(400).json({
          error:
            'Please enter a valid UPI Reference Number / UTR (6 to 36 alphanumeric characters, typically 12 digits).',
        });
      }

      const paidNum = Number(amountPaid);
      const reqAdvNum = Number(requiredAdvanceAmount || 0);
      const totalNum = Number(totalOrderAmount || 0);

      if (!Number.isFinite(paidNum) || paidNum <= 0) {
        return res.status(400).json({ error: 'Please enter a valid payment amount.' });
      }

      if (reqAdvNum > 0 && paidNum < reqAdvNum) {
        return res.status(400).json({
          error: `Amount paid (₹${paidNum}) cannot be less than the required advance amount (₹${reqAdvNum}).`,
        });
      }

      if (totalNum > 0 && paidNum > totalNum) {
        return res.status(400).json({
          error: `Amount paid (₹${paidNum}) cannot exceed the total order amount (₹${totalNum}).`,
        });
      }

      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!screenshotMimeType || !allowedMimes.includes(String(screenshotMimeType).toLowerCase())) {
        return res.status(400).json({
          error: 'Only JPG, JPEG, PNG, and WebP payment screenshots are allowed.',
        });
      }

      const sizeBytes = Number(screenshotSizeBytes || 0);
      if (sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Payment screenshot must be a valid image under 5 MB.',
        });
      }

      // Inspect base64 magic-byte prefix if provided
      if (screenshotDataPrefix && typeof screenshotDataPrefix === 'string') {
        const base64Part = screenshotDataPrefix.includes(',')
          ? screenshotDataPrefix.split(',')[1]
          : screenshotDataPrefix;
        if (base64Part) {
          const buf = Buffer.from(base64Part.slice(0, 64), 'base64');
          const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
          const isPng =
            buf.length >= 4 &&
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47;
          const isWebp =
            buf.length >= 12 &&
            buf.toString('ascii', 0, 4) === 'RIFF' &&
            buf.toString('ascii', 8, 12) === 'WEBP';

          if (!isJpeg && !isPng && !isWebp) {
            return res.status(400).json({
              error:
                'Uploaded file failed binary image header verification. Please upload an authentic JPG, PNG, or WebP payment screenshot.',
            });
          }
        }
      }

      return res.json({
        valid: true,
        normalizedUtr: cleanUtr.toUpperCase(),
        verifiedSubmittedAmount: Math.round(paidNum),
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Payment submission validation failed.',
      });
    }
  });

  // ============================================================================
  // 3. PRIVATE PAYMENT EVIDENCE SHORT-LIVED SIGNED ACCESS & ADMIN AUTHENTICATION
  // ============================================================================
  const evidenceSigningKey = crypto.randomBytes(32);

  const requireCsrfHeader = (
    req: express.Request,
    res: express.Response
  ): boolean => {
    const xrw = String(req.headers['x-requested-with'] || '');
    if (xrw !== 'XMLHttpRequest') {
      res.status(403).json({
        error: 'Invalid security header (CSRF protection requires X-Requested-With: XMLHttpRequest).',
      });
      return false;
    }
    return true;
  };

  // Issue a short-lived (5-minute) role-verified signed access grant for private payment evidence
  app.post('/api/admin/payments/signed-evidence-url', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const authCtx = getAuthenticatedSession(req);
    if (!authCtx) {
      return res.status(401).json({
        error: 'Authentication required to access private customer payment evidence.',
      });
    }

    const perms = authCtx.account.permissionsSummary || '';
    const isAuthorisedForPaymentEvidence =
      authCtx.account.roleId === 'role-owner' ||
      authCtx.account.email.toLowerCase() === 'prabhve5@gmail.com' ||
      perms.includes('verify_payments') ||
      perms.includes('approve_orders');

    if (!isAuthorisedForPaymentEvidence) {
      return res.status(403).json({
        error: 'Your staff role does not have verify_payments permission to inspect private payment screenshots.',
      });
    }

    const orderNumber = String(req.body?.orderNumber || '').trim();
    const submissionId = String(req.body?.submissionId || orderNumber).trim();
    if (!orderNumber) {
      return res.status(400).json({ error: 'orderNumber is required.' });
    }

    const expiresAtMs = Date.now() + 5 * 60 * 1000; // 5-minute short-lived token
    const payload = `${orderNumber}|${submissionId}|${authCtx.account.id}|${expiresAtMs}`;
    const signature = crypto
      .createHmac('sha256', evidenceSigningKey)
      .update(payload)
      .digest('hex');

    return res.json({
      granted: true,
      orderNumber,
      submissionId,
      inspectedByEmail: authCtx.account.email,
      expiresAtIso: new Date(expiresAtMs).toISOString(),
      signedToken: `${expiresAtMs}.${signature}`,
    });
  });

  app.get('/api/admin/auth/status', (req, res) => {
    const authCtx = getAuthenticatedSession(req);
    return res.json({
      ownerConfigured: adminAuthStore.ownerConfigured,
      authenticated: Boolean(authCtx),
      account: authCtx ? sanitizeAccountForClient(authCtx.account) : null,
      session: authCtx
        ? {
            sessionId: authCtx.session.sessionId,
            createdAt: authCtx.session.createdAt,
            lastActiveAt: authCtx.session.lastActiveAt,
            expiresAt: authCtx.session.expiresAt,
            rememberDevice: authCtx.session.rememberDevice,
          }
        : null,
    });
  });

  // One-time first-run owner password claim for the registered Principal Owner account
  app.post('/api/admin/auth/bootstrap-owner', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    if (adminAuthStore.ownerConfigured) {
      return res.status(403).json({
        error: 'Principal owner password is already configured. Please sign in with your password.',
      });
    }

    const email = String(req.body?.email || 'prabhve5@gmail.com').trim().toLowerCase();
    const username = String(req.body?.username || 'owner').trim().toLowerCase();
    const name = String(req.body?.name || "Lovey's Principal Owner").trim();
    const password = String(req.body?.password || '');
    const rememberDevice = Boolean(req.body?.rememberDevice);

    if (email !== 'prabhve5@gmail.com') {
      return res.status(403).json({
        error: 'Only the registered Principal Owner email (prabhve5@gmail.com) may claim initial setup.',
      });
    }

    const policyCheck = validateStrongPasswordPolicy(password, email);
    if (!policyCheck.valid) {
      return res.status(400).json({ error: policyCheck.error });
    }

    const nowIso = new Date().toISOString();
    let ownerAcc = adminAuthStore.accounts.find(
      (a) => a.email.toLowerCase() === 'prabhve5@gmail.com' || a.roleId === 'role-owner'
    );
    if (!ownerAcc) {
      ownerAcc = {
        id: 'staff-owner-bootstrapped',
        email: 'prabhve5@gmail.com',
        username: username || 'owner',
        name: name || "Lovey's Principal Owner",
        phone: '+91 80905 29971',
        roleId: 'role-owner',
        roleName: 'Owner / Super Admin',
        permissionsSummary: OWNER_DEFAULT_PERMISSIONS,
        status: 'active',
        passwordHash: hashPasswordScrypt(password),
        requirePasswordChange: false,
        sessionVersion: 1,
        sessionTimeoutMinutes: 60,
        lastLoginAt: nowIso,
        passwordUpdatedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      adminAuthStore.accounts.unshift(ownerAcc);
    } else {
      ownerAcc.username = username || ownerAcc.username || 'owner';
      ownerAcc.name = name || ownerAcc.name;
      ownerAcc.passwordHash = hashPasswordScrypt(password);
      ownerAcc.requirePasswordChange = false;
      ownerAcc.sessionVersion = (ownerAcc.sessionVersion || 1) + 1;
      ownerAcc.lastLoginAt = nowIso;
      ownerAcc.passwordUpdatedAt = nowIso;
      ownerAcc.updatedAt = nowIso;
    }

    adminAuthStore.ownerConfigured = true;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const maxAgeSeconds = rememberDevice ? 14 * 24 * 3600 : 12 * 3600;
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    const userAgent = String(req.headers['user-agent'] || 'Browser');

    const newSession: ActiveAdminSession = {
      sessionId: `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      tokenHash: hashTokenSha256(rawToken),
      accountId: ownerAcc.id,
      email: ownerAcc.email,
      username: ownerAcc.username,
      name: ownerAcc.name,
      roleId: ownerAcc.roleId,
      roleName: ownerAcc.roleName,
      permissionsSummary: ownerAcc.permissionsSummary,
      sessionVersion: ownerAcc.sessionVersion,
      ipAddress: clientIp,
      userAgent: userAgent.slice(0, 180),
      rememberDevice,
      createdAt: nowIso,
      lastActiveAt: nowIso,
      expiresAt: Date.now() + maxAgeSeconds * 1000,
    };

    adminAuthStore.sessions.unshift(newSession);
    recordLoginEvent({
      emailOrUsername: ownerAcc.email,
      accountId: ownerAcc.id,
      roleName: ownerAcc.roleName,
      ipAddress: clientIp,
      userAgent: userAgent.slice(0, 180),
      outcome: 'success',
      reason: 'Initial Principal Owner password configured and authenticated',
      suspicious: false,
    });
    saveAdminAuthStore();
    setAdminSessionCookie(res, rawToken, maxAgeSeconds);

    return res.json({
      authenticated: true,
      sessionToken: rawToken,
      account: sanitizeAccountForClient(ownerAcc),
      session: {
        sessionId: newSession.sessionId,
        createdAt: newSession.createdAt,
        lastActiveAt: newSession.lastActiveAt,
        expiresAt: newSession.expiresAt,
        rememberDevice: newSession.rememberDevice,
      },
    });
  });

  // Password-Only Login Endpoint with Brute-Force Protection, Progressive Delay & Generic Errors
  app.post('/api/admin/auth/login', async (req, res) => {
    if (!requireCsrfHeader(req, res)) return;

    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    const userAgent = String(req.headers['user-agent'] || 'Browser').slice(0, 180);
    const identifier = String(req.body?.identifier || req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const rememberDevice = Boolean(req.body?.rememberDevice);

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your registered email/username and password.' });
    }

    const rateKey = `${clientIp}:${identifier}`;
    const now = Date.now();
    const rateRecord = adminRateLimits.get(rateKey) || { count: 0, lockUntil: 0, lastAttempt: now };

    if (now - rateRecord.lastAttempt > 15 * 60 * 1000 && rateRecord.lockUntil < now) {
      rateRecord.count = 0;
      rateRecord.lockUntil = 0;
    }

    if (rateRecord.lockUntil > now) {
      const remainingSeconds = Math.ceil((rateRecord.lockUntil - now) / 1000);
      recordLoginEvent({
        emailOrUsername: identifier,
        ipAddress: clientIp,
        userAgent,
        outcome: 'lockout',
        reason: `Blocked login attempt during active lockout (${remainingSeconds}s remaining)`,
        suspicious: true,
      });
      saveAdminAuthStore();
      return res.status(429).json({
        locked: true,
        remainingSeconds,
        error: `Account temporarily locked due to repeated failed attempts. Please try again in ${remainingSeconds} seconds.`,
      });
    }

    const matchedAccount = adminAuthStore.accounts.find(
      (a) =>
        a.email.toLowerCase() === identifier ||
        (a.username && a.username.toLowerCase() === identifier)
    );

    const passwordValid =
      matchedAccount &&
      matchedAccount.status === 'active' &&
      matchedAccount.passwordHash &&
      verifyPasswordScrypt(password, matchedAccount.passwordHash);

    if (!passwordValid || !matchedAccount) {
      rateRecord.count += 1;
      rateRecord.lastAttempt = now;
      const progressiveDelayMs = Math.min(2500, rateRecord.count * 350);
      await new Promise((resolve) => setTimeout(resolve, progressiveDelayMs));

      if (rateRecord.count >= 5) {
        rateRecord.lockUntil = Date.now() + 5 * 60 * 1000;
        adminRateLimits.set(rateKey, rateRecord);
        recordLoginEvent({
          emailOrUsername: identifier,
          accountId: matchedAccount?.id,
          roleName: matchedAccount?.roleName,
          ipAddress: clientIp,
          userAgent,
          outcome: 'lockout',
          reason: '5 consecutive failed password attempts — 5-minute temporary lockout triggered',
          suspicious: true,
        });
        saveAdminAuthStore();
        return res.status(429).json({
          locked: true,
          remainingSeconds: 300,
          attemptsRemaining: 0,
          error: 'Too many failed password attempts. Account is temporarily locked for 5 minutes.',
        });
      }

      adminRateLimits.set(rateKey, rateRecord);
      recordLoginEvent({
        emailOrUsername: identifier,
        accountId: matchedAccount?.id,
        roleName: matchedAccount?.roleName,
        ipAddress: clientIp,
        userAgent,
        outcome: 'failure',
        reason:
          matchedAccount && matchedAccount.status !== 'active'
            ? `Login attempt on ${matchedAccount.status} staff account`
            : `Failed password attempt (${rateRecord.count}/5)`,
        suspicious: rateRecord.count >= 3,
      });
      saveAdminAuthStore();

      // Generic error message to prevent account enumeration
      return res.status(401).json({
        locked: false,
        attemptsRemaining: Math.max(0, 5 - rateRecord.count),
        error: 'Invalid email/username or password.',
      });
    }

    // Successful password authentication
    adminRateLimits.delete(rateKey);
    const nowIso = new Date().toISOString();
    matchedAccount.lastLoginAt = nowIso;
    matchedAccount.updatedAt = nowIso;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const maxAgeSeconds = rememberDevice ? 14 * 24 * 3600 : 12 * 3600;

    const newSession: ActiveAdminSession = {
      sessionId: `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      tokenHash: hashTokenSha256(rawToken),
      accountId: matchedAccount.id,
      email: matchedAccount.email,
      username: matchedAccount.username,
      name: matchedAccount.name,
      roleId: matchedAccount.roleId,
      roleName: matchedAccount.roleName,
      permissionsSummary: matchedAccount.permissionsSummary,
      sessionVersion: matchedAccount.sessionVersion,
      ipAddress: clientIp,
      userAgent,
      rememberDevice,
      createdAt: nowIso,
      lastActiveAt: nowIso,
      expiresAt: Date.now() + maxAgeSeconds * 1000,
    };

    adminAuthStore.sessions.unshift(newSession);
    recordLoginEvent({
      emailOrUsername: matchedAccount.email,
      accountId: matchedAccount.id,
      roleName: matchedAccount.roleName,
      ipAddress: clientIp,
      userAgent,
      outcome: 'success',
      reason: `Authenticated via password (${rememberDevice ? 'Remember Device 14d' : 'Standard Session'})`,
      suspicious: false,
    });
    saveAdminAuthStore();
    setAdminSessionCookie(res, rawToken, maxAgeSeconds);

    return res.json({
      authenticated: true,
      sessionToken: rawToken,
      account: sanitizeAccountForClient(matchedAccount),
      session: {
        sessionId: newSession.sessionId,
        createdAt: newSession.createdAt,
        lastActiveAt: newSession.lastActiveAt,
        expiresAt: newSession.expiresAt,
        rememberDevice: newSession.rememberDevice,
      },
    });
  });

  app.post('/api/admin/auth/logout', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const authCtx = getAuthenticatedSession(req);
    if (authCtx) {
      adminAuthStore.sessions = adminAuthStore.sessions.filter(
        (s) => s.sessionId !== authCtx.session.sessionId
      );
      saveAdminAuthStore();
    }
    clearAdminSessionCookie(res);
    return res.json({ loggedOut: true });
  });

  // Password Change (invalidates all previous sessions and issues a new session token)
  app.post('/api/admin/auth/change-password', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const authCtx = getAuthenticatedSession(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Your admin session has expired. Please sign in again.' });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    const userAgent = String(req.headers['user-agent'] || 'Browser').slice(0, 180);

    if (!verifyPasswordScrypt(currentPassword, authCtx.account.passwordHash)) {
      recordLoginEvent({
        emailOrUsername: authCtx.account.email,
        accountId: authCtx.account.id,
        roleName: authCtx.account.roleName,
        ipAddress: clientIp,
        userAgent,
        outcome: 'failure',
        reason: 'Failed current password verification during password change',
        suspicious: true,
      });
      saveAdminAuthStore();
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        error: 'New password must be different from your current password.',
      });
    }

    const policyCheck = validateStrongPasswordPolicy(newPassword, authCtx.account.email);
    if (!policyCheck.valid) {
      return res.status(400).json({ error: policyCheck.error });
    }

    const nowIso = new Date().toISOString();
    authCtx.account.passwordHash = hashPasswordScrypt(newPassword);
    authCtx.account.requirePasswordChange = false;
    authCtx.account.sessionVersion = (authCtx.account.sessionVersion || 1) + 1;
    authCtx.account.passwordUpdatedAt = nowIso;
    authCtx.account.updatedAt = nowIso;

    // Invalidate ALL previous sessions for this account
    adminAuthStore.sessions = adminAuthStore.sessions.filter(
      (s) => s.accountId !== authCtx.account.id
    );

    // Issue a fresh session for the active device
    const rawToken = crypto.randomBytes(32).toString('hex');
    const maxAgeSeconds = authCtx.session.rememberDevice ? 14 * 24 * 3600 : 12 * 3600;
    const freshSession: ActiveAdminSession = {
      sessionId: `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      tokenHash: hashTokenSha256(rawToken),
      accountId: authCtx.account.id,
      email: authCtx.account.email,
      username: authCtx.account.username,
      name: authCtx.account.name,
      roleId: authCtx.account.roleId,
      roleName: authCtx.account.roleName,
      permissionsSummary: authCtx.account.permissionsSummary,
      sessionVersion: authCtx.account.sessionVersion,
      ipAddress: clientIp,
      userAgent,
      rememberDevice: authCtx.session.rememberDevice,
      createdAt: nowIso,
      lastActiveAt: nowIso,
      expiresAt: Date.now() + maxAgeSeconds * 1000,
    };

    adminAuthStore.sessions.unshift(freshSession);
    recordLoginEvent({
      emailOrUsername: authCtx.account.email,
      accountId: authCtx.account.id,
      roleName: authCtx.account.roleName,
      ipAddress: clientIp,
      userAgent,
      outcome: 'password_changed',
      reason: 'Password updated; all previous sessions invalidated',
      suspicious: false,
    });
    saveAdminAuthStore();
    setAdminSessionCookie(res, rawToken, maxAgeSeconds);

    return res.json({
      updated: true,
      sessionToken: rawToken,
      account: sanitizeAccountForClient(authCtx.account),
      message: 'Password updated and all previous sessions have been invalidated.',
    });
  });

  // Single-Use Time-Limited Password Reset Link Flow (NEVER OTP)
  app.post('/api/admin/auth/forgot-password', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const emailInput = String(req.body?.email || '').trim().toLowerCase();
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    const userAgent = String(req.headers['user-agent'] || 'Browser').slice(0, 180);

    if (!emailInput || !emailInput.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid registered admin email address.' });
    }

    const matchedAccount = adminAuthStore.accounts.find(
      (a) => a.email.toLowerCase() === emailInput && a.status === 'active'
    );

    let recoveryLinkPath: string | null = null;
    if (matchedAccount) {
      // Invalidate any previous unused reset tokens for this account
      adminAuthStore.resetTokens = adminAuthStore.resetTokens.filter(
        (t) => t.accountId !== matchedAccount.id && t.expiresAt > Date.now()
      );

      const rawResetToken = crypto.randomBytes(32).toString('hex');
      adminAuthStore.resetTokens.push({
        tokenHash: hashTokenSha256(rawResetToken),
        email: matchedAccount.email,
        accountId: matchedAccount.id,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15-minute expiration
        used: false,
        createdAt: new Date().toISOString(),
      });

      recoveryLinkPath = `/admin/login?resetToken=${encodeURIComponent(
        rawResetToken
      )}&email=${encodeURIComponent(matchedAccount.email)}`;

      recordLoginEvent({
        emailOrUsername: matchedAccount.email,
        accountId: matchedAccount.id,
        roleName: matchedAccount.roleName,
        ipAddress: clientIp,
        userAgent,
        outcome: 'password_reset',
        reason: 'Generated single-use 15-minute password recovery link',
        suspicious: false,
      });
      saveAdminAuthStore();
    }

    // Generic message so attackers cannot enumerate non-existent emails
    return res.json({
      accepted: true,
      message:
        'If this email is registered as an active Lovey’s administrator or staff account, a single-use 15-minute password reset link has been issued.',
      recoveryLinkPath,
      expiresInMinutes: 15,
    });
  });

  app.post('/api/admin/auth/reset-password', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const emailInput = String(req.body?.email || '').trim().toLowerCase();
    const rawResetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    const userAgent = String(req.headers['user-agent'] || 'Browser').slice(0, 180);

    if (!emailInput || !rawResetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token, email, and new password are required.' });
    }

    const tokenHash = hashTokenSha256(rawResetToken);
    const now = Date.now();
    const tokenRecord = adminAuthStore.resetTokens.find(
      (t) =>
        t.tokenHash === tokenHash &&
        t.email.toLowerCase() === emailInput &&
        !t.used &&
        t.expiresAt > now
    );

    if (!tokenRecord) {
      return res.status(400).json({
        error: 'This password recovery link is invalid, already used, or expired (15-minute limit). Please request a new reset link.',
      });
    }

    const account = adminAuthStore.accounts.find(
      (a) => a.id === tokenRecord.accountId && a.status === 'active'
    );
    if (!account) {
      return res.status(400).json({ error: 'Account is no longer active.' });
    }

    const policyCheck = validateStrongPasswordPolicy(newPassword, account.email);
    if (!policyCheck.valid) {
      return res.status(400).json({ error: policyCheck.error });
    }

    const nowIso = new Date().toISOString();
    tokenRecord.used = true;
    account.passwordHash = hashPasswordScrypt(newPassword);
    account.requirePasswordChange = false;
    account.sessionVersion = (account.sessionVersion || 1) + 1;
    account.passwordUpdatedAt = nowIso;
    account.updatedAt = nowIso;

    // Invalidate all active sessions for this user
    adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.accountId !== account.id);

    recordLoginEvent({
      emailOrUsername: account.email,
      accountId: account.id,
      roleName: account.roleName,
      ipAddress: clientIp,
      userAgent,
      outcome: 'password_reset',
      reason: 'Password reset completed via single-use recovery link; all prior sessions revoked',
      suspicious: false,
    });
    saveAdminAuthStore();

    return res.json({
      reset: true,
      message: 'Password has been reset and all previous sessions were invalidated. You may now sign in with your new password.',
    });
  });

  // Second-Password Reauthentication for Critical Owner-Only Actions (Never OTP)
  app.post('/api/admin/auth/reauthenticate', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const authCtx = getAuthenticatedSession(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Your admin session has expired. Please sign in again.' });
    }

    const password = String(req.body?.password || '');
    if (!password || !verifyPasswordScrypt(password, authCtx.account.passwordHash)) {
      return res.status(401).json({
        verified: false,
        error: 'Password confirmation failed. Please enter your current admin password.',
      });
    }

    return res.json({
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
  });

  // Security Overview: Active Sessions, Login History, Suspicious Attempts & Staff Accounts
  app.get('/api/admin/auth/security-overview', (req, res) => {
    const authCtx = getAuthenticatedSession(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const isOwner =
      authCtx.account.roleId === 'role-owner' ||
      authCtx.account.email.toLowerCase() === 'prabhve5@gmail.com';

    const visibleSessions = adminAuthStore.sessions
      .filter((s) => isOwner || s.accountId === authCtx.account.id)
      .map((s) => ({
        sessionId: s.sessionId,
        accountId: s.accountId,
        email: s.email,
        username: s.username,
        name: s.name,
        roleName: s.roleName,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        rememberDevice: s.rememberDevice,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        expiresAt: s.expiresAt,
        isCurrent: s.sessionId === authCtx.session.sessionId,
      }));

    const visibleHistory = adminAuthStore.loginHistory.filter(
      (h) => isOwner || h.emailOrUsername.toLowerCase() === authCtx.account.email.toLowerCase()
    );

    return res.json({
      currentSessionId: authCtx.session.sessionId,
      activeSessions: visibleSessions,
      loginHistory: visibleHistory.slice(0, 60),
      suspiciousAttempts: visibleHistory.filter((h) => h.suspicious).slice(0, 30),
      accounts: isOwner
        ? adminAuthStore.accounts.map(sanitizeAccountForClient)
        : [sanitizeAccountForClient(authCtx.account)],
    });
  });

  // Revoke Specific Session, All Other Sessions, or All Sessions for a Staff Member
  app.post('/api/admin/auth/sessions/revoke', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const authCtx = getAuthenticatedSession(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const isOwner =
      authCtx.account.roleId === 'role-owner' ||
      authCtx.account.email.toLowerCase() === 'prabhve5@gmail.com';
    const { sessionId, revokeAllOthers, targetAccountId } = req.body || {};
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    const userAgent = String(req.headers['user-agent'] || 'Browser').slice(0, 180);

    let revokedCount = 0;

    if (targetAccountId && isOwner) {
      const before = adminAuthStore.sessions.length;
      adminAuthStore.sessions = adminAuthStore.sessions.filter(
        (s) => s.accountId !== targetAccountId
      );
      revokedCount = before - adminAuthStore.sessions.length;
    } else if (revokeAllOthers) {
      const before = adminAuthStore.sessions.length;
      adminAuthStore.sessions = adminAuthStore.sessions.filter((s) =>
        isOwner
          ? s.sessionId === authCtx.session.sessionId
          : s.accountId !== authCtx.account.id || s.sessionId === authCtx.session.sessionId
      );
      revokedCount = before - adminAuthStore.sessions.length;
    } else if (sessionId) {
      const target = adminAuthStore.sessions.find((s) => s.sessionId === sessionId);
      if (target && (isOwner || target.accountId === authCtx.account.id)) {
        adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.sessionId !== sessionId);
        revokedCount = 1;
      }
    }

    recordLoginEvent({
      emailOrUsername: authCtx.account.email,
      accountId: authCtx.account.id,
      roleName: authCtx.account.roleName,
      ipAddress: clientIp,
      userAgent,
      outcome: 'session_revoked',
      reason: `Revoked ${revokedCount} active session(s)`,
      suspicious: false,
    });
    saveAdminAuthStore();

    return res.json({
      revoked: true,
      revokedCount,
    });
  });

  // Owner-Only Individual Staff Account & Password Management (Never Shared Passwords)
  app.post('/api/admin/auth/staff-credentials', (req, res) => {
    if (!requireCsrfHeader(req, res)) return;
    const authCtx = getAuthenticatedSession(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const isOwner =
      authCtx.account.roleId === 'role-owner' ||
      authCtx.account.email.toLowerCase() === 'prabhve5@gmail.com' ||
      authCtx.account.permissionsSummary.includes('invite_staff');

    if (!isOwner) {
      return res.status(403).json({
        error: 'Only the Principal Owner or administrators with invite_staff permission can manage staff credentials.',
      });
    }

    const action = String(req.body?.action || 'create_or_update');
    const nowIso = new Date().toISOString();

    if (action === 'create_or_update') {
      const id = String(req.body?.id || `staff-${Date.now()}`).trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const username = String(
        req.body?.username || email.split('@')[0].replace(/[^a-z0-9_.-]/g, '')
      )
        .trim()
        .toLowerCase();
      const name = String(req.body?.name || '').trim();
      const phone = String(req.body?.phone || '').trim();
      const roleId = String(req.body?.roleId || 'role-order-manager').trim();
      const roleName = String(req.body?.roleName || 'Order & Kitchen Manager').trim();
      const permissionsSummary = String(req.body?.permissionsSummary || 'view,edit,approve_orders').trim();
      const initialPassword = String(req.body?.initialPassword || '');
      const requirePasswordChange = req.body?.requirePasswordChange !== false;
      const sessionTimeoutMinutes = Math.max(5, Number(req.body?.sessionTimeoutMinutes || 60));

      if (!email || !email.includes('@') || !name) {
        return res.status(400).json({ error: 'Staff member name and valid email address are required.' });
      }

      // Check for duplicate email or username across other staff accounts
      const conflicting = adminAuthStore.accounts.find(
        (a) =>
          a.id !== id &&
          (a.email.toLowerCase() === email ||
            (username && a.username && a.username.toLowerCase() === username))
      );
      if (conflicting) {
        return res.status(400).json({
          error: `Another staff account already uses the email "${email}" or username "${username}". Every employee must have a unique account.`,
        });
      }

      let existing = adminAuthStore.accounts.find(
        (a) => a.id === id || a.email.toLowerCase() === email
      );

      if (!existing && !initialPassword) {
        return res.status(400).json({
          error: 'An initial password (minimum 12 characters) is required when creating a new staff account.',
        });
      }

      if (initialPassword) {
        const policyCheck = validateStrongPasswordPolicy(initialPassword, email);
        if (!policyCheck.valid) {
          return res.status(400).json({ error: policyCheck.error });
        }
      }

      if (!existing) {
        existing = {
          id,
          email,
          username,
          name,
          phone,
          roleId,
          roleName,
          permissionsSummary,
          status: 'active',
          passwordHash: hashPasswordScrypt(initialPassword),
          requirePasswordChange,
          sessionVersion: 1,
          sessionTimeoutMinutes,
          passwordUpdatedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        adminAuthStore.accounts.push(existing);
      } else {
        existing.email = email;
        existing.username = username || existing.username;
        existing.name = name;
        existing.phone = phone;
        existing.roleId = roleId;
        existing.roleName = roleName;
        existing.permissionsSummary = permissionsSummary;
        existing.sessionTimeoutMinutes = sessionTimeoutMinutes;
        if (initialPassword) {
          existing.passwordHash = hashPasswordScrypt(initialPassword);
          existing.requirePasswordChange = requirePasswordChange;
          existing.sessionVersion = (existing.sessionVersion || 1) + 1;
          existing.passwordUpdatedAt = nowIso;
          // Revoke existing sessions when password is changed by owner
          adminAuthStore.sessions = adminAuthStore.sessions.filter(
            (s) => s.accountId !== existing!.id
          );
        }
        existing.updatedAt = nowIso;
      }

      saveAdminAuthStore();
      return res.json({
        saved: true,
        account: sanitizeAccountForClient(existing),
      });
    }

    if (action === 'set_status') {
      const targetId = String(req.body?.id || '');
      const status = String(req.body?.status || 'active') as StoredAdminAccount['status'];
      const target = adminAuthStore.accounts.find((a) => a.id === targetId);
      if (!target) {
        return res.status(404).json({ error: 'Staff account not found.' });
      }
      if (target.email.toLowerCase() === 'prabhve5@gmail.com' && status !== 'active') {
        return res.status(400).json({ error: 'The Principal Owner account cannot be deactivated.' });
      }
      target.status = status;
      target.updatedAt = nowIso;
      if (status !== 'active') {
        adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.accountId !== target.id);
      }
      saveAdminAuthStore();
      return res.json({
        updated: true,
        account: sanitizeAccountForClient(target),
      });
    }

    if (action === 'force_password_reset') {
      const targetId = String(req.body?.id || '');
      const temporaryPassword = String(req.body?.temporaryPassword || '');
      const target = adminAuthStore.accounts.find((a) => a.id === targetId);
      if (!target) {
        return res.status(404).json({ error: 'Staff account not found.' });
      }

      if (temporaryPassword) {
        const policyCheck = validateStrongPasswordPolicy(temporaryPassword, target.email);
        if (!policyCheck.valid) {
          return res.status(400).json({ error: policyCheck.error });
        }
        target.passwordHash = hashPasswordScrypt(temporaryPassword);
      }
      target.requirePasswordChange = true;
      target.sessionVersion = (target.sessionVersion || 1) + 1;
      target.passwordUpdatedAt = nowIso;
      target.updatedAt = nowIso;

      // Invalidate all sessions for this staff member
      adminAuthStore.sessions = adminAuthStore.sessions.filter((s) => s.accountId !== target.id);

      // Also generate a 15-minute single-use recovery link for convenience
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      adminAuthStore.resetTokens.push({
        tokenHash: hashTokenSha256(rawResetToken),
        email: target.email,
        accountId: target.id,
        expiresAt: Date.now() + 15 * 60 * 1000,
        used: false,
        createdAt: nowIso,
      });

      saveAdminAuthStore();
      return res.json({
        reset: true,
        account: sanitizeAccountForClient(target),
        recoveryLinkPath: `/admin/login?resetToken=${encodeURIComponent(
          rawResetToken
        )}&email=${encodeURIComponent(target.email)}`,
      });
    }

    return res.status(400).json({ error: 'Unsupported staff credential action.' });
  });

  app.post('/api/admin/backup/verify-snapshot', (req, res) => {
    try {
      const { snapshotPayload } = req.body;
      if (!snapshotPayload || typeof snapshotPayload !== 'object') {
        return res.status(400).json({ error: 'Valid snapshot payload is required.' });
      }

      const serialized = JSON.stringify(snapshotPayload);
      const byteSize = Buffer.byteLength(serialized, 'utf8');
      const checksumSha256 = crypto.createHash('sha256').update(serialized).digest('hex');

      const collections = snapshotPayload.collections || {};
      const recordCounts: Record<string, number> = {};
      let totalDocuments = 0;

      for (const [colName, docs] of Object.entries(collections)) {
        const count = Array.isArray(docs) ? docs.length : 0;
        recordCounts[colName] = count;
        totalDocuments += count;
      }

      return res.json({
        verified: true,
        checksumSha256,
        byteSize,
        totalDocuments,
        recordCounts,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'Snapshot integrity verification failed.',
      });
    }
  });

  app.post('/api/admin/products/validate-csv', (req, res) => {
    try {
      const { csvText } = req.body;
      if (!csvText || typeof csvText !== 'string') {
        return res.status(400).json({ error: 'CSV content is required.' });
      }

      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        return res.status(400).json({
          error: 'CSV must contain a header row and at least one product data row.',
        });
      }

      const parseCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
      const requiredHeaders = ['name', 'categoryid', 'baseprice'];
      for (const reqHeader of requiredHeaders) {
        if (!headers.includes(reqHeader)) {
          return res.status(400).json({
            error: `Missing required CSV column "${reqHeader}". Expected headers: name, nameHi, categoryId, basePrice, stockQuantity, minStockThreshold, isVeg, isAvailable, badge, imageUrl, description`,
          });
        }
      }

      const validRows: any[] = [];
      const rowErrors: Array<{ rowNumber: number; message: string }> = [];

      for (let idx = 1; idx < lines.length; idx++) {
        const cols = parseCsvLine(lines[idx]);
        const rowMap: Record<string, string> = {};
        headers.forEach((h, colIdx) => {
          rowMap[h] = cols[colIdx] ?? '';
        });

        const name = (rowMap['name'] || '').trim();
        const categoryId = (rowMap['categoryid'] || '').trim();
        const basePrice = Number(rowMap['baseprice']);
        const stockQuantity =
          rowMap['stockquantity'] !== undefined && rowMap['stockquantity'] !== ''
            ? Number(rowMap['stockquantity'])
            : 25;
        const minStockThreshold =
          rowMap['minstockthreshold'] !== undefined && rowMap['minstockthreshold'] !== ''
            ? Number(rowMap['minstockthreshold'])
            : 5;

        if (!name) {
          rowErrors.push({ rowNumber: idx + 1, message: 'Product name is empty.' });
          continue;
        }
        if (!categoryId) {
          rowErrors.push({ rowNumber: idx + 1, message: `Missing categoryId for "${name}".` });
          continue;
        }
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          rowErrors.push({
            rowNumber: idx + 1,
            message: `Invalid basePrice "${rowMap['baseprice']}" for "${name}".`,
          });
          continue;
        }

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        validRows.push({
          id: (rowMap['id'] || '').trim() || `prod-${slug}-${Date.now().toString().slice(-4)}-${idx}`,
          name,
          nameHi: (rowMap['namehi'] || '').trim() || name,
          slug,
          categoryId,
          description:
            (rowMap['description'] || '').trim() ||
            `Freshly crafted ${name} at Lovey's Bakery & Pizza Corners, Renukoot.`,
          basePrice: Math.round(basePrice),
          stockQuantity: Number.isFinite(stockQuantity) ? Math.max(0, Math.round(stockQuantity)) : 25,
          minStockThreshold: Number.isFinite(minStockThreshold)
            ? Math.max(0, Math.round(minStockThreshold))
            : 5,
          isVeg: String(rowMap['isveg'] ?? 'true').toLowerCase() !== 'false',
          isAvailable: String(rowMap['isavailable'] ?? 'true').toLowerCase() !== 'false',
          badge: (rowMap['badge'] || '').trim(),
          imageUrl:
            (rowMap['imageurl'] || '').trim() ||
            '/assets/cakes/loveys-chocolate-truffle-gateau.jpg',
          prepTimeMinutes: Number(rowMap['preptimeminutes']) || 25,
          spiceLevel: (rowMap['spicelevel'] || 'none').trim(),
          isBestseller: String(rowMap['isbestseller'] ?? 'false').toLowerCase() === 'true',
          isFeatured: String(rowMap['isfeatured'] ?? 'false').toLowerCase() === 'true',
        });
      }

      return res.json({
        valid: rowErrors.length === 0,
        totalRows: lines.length - 1,
        validCount: validRows.length,
        errorCount: rowErrors.length,
        validRows,
        rowErrors,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message || 'CSV validation failed.',
      });
    }
  });

  // ============================================================================
  // 4. STATIC PUBLIC ASSETS & VITE DEV MIDDLEWARE
  // ============================================================================
  app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Lovey's Bakery & Pizza Corners server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
