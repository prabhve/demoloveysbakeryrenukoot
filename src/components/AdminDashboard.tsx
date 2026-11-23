import React, { useState, useEffect } from 'react';
import {
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadString,
  getDownloadURL,
} from 'firebase/storage';
import {
  db,
  storage,
  OperationType,
  handleFirestoreError,
} from '../lib/firebase';
import {
  BusinessSettings,
  PaymentSettings,
  OrderPaymentRecord,
  PaymentSubmissionRecord,
  PaymentVerificationHistoryRecord,
  INITIAL_PAYMENT_SETTINGS,
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
  INITIAL_ROLE_DEFINITIONS,
  INITIAL_STAFF_MEMBERS,
  INITIAL_WEBSITE_CONFIG,
  INITIAL_CUSTOM_PAGES,
} from '../data/initialCatalogue';
import { BmsInventoryModule } from './bms/BmsInventoryModule';
import { BmsWebsiteCmsModule } from './bms/BmsWebsiteCmsModule';
import { BmsSecurityAndStaffModule } from './bms/BmsSecurityAndStaffModule';
import { BmsCrmAndAnalyticsModule } from './bms/BmsCrmAndAnalyticsModule';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Cake,
  Image as ImageIcon,
  Users,
  TicketPercent,
  QrCode,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Download,
  CheckCircle2,
  LogOut,
  ExternalLink,
  Search,
  Upload,
  MessageCircle,
  Phone,
  Video,
  CreditCard,
  ShieldCheck,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Bell,
  Globe,
  Layers,
  Shield,
  Activity,
  HelpCircle,
  Copy,
  Archive,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
} from 'lucide-react';

export interface OrderRecord {
  orderNumber: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp?: string;
  customerEmail?: string;
  fulfilmentType: 'delivery' | 'pickup' | 'dine_in';
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  advanceRequired?: boolean;
  requiredAdvanceAmount?: number;
  submittedAdvanceAmount?: number;
  verifiedAdvanceAmount?: number;
  remainingBalanceAmount?: number;
  paymentDeadlineIso?: string;
  latestSubmissionId?: string;
  paymentRejectionReason?: string;
  deliveryAddress?: string;
  pinCode?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  tableNumber?: string;
  specialInstructions?: string;
  couponCode?: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  packagingCharge: number;
  taxAmount: number;
  totalAmount: number;
  itemsSummary: string;
  orderedItemsJson?: string;
  stockRestored?: boolean;
  customCakeDetails?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface AdminDashboardProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  userEmail: string | null;
  isAdminUser: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  settings: BusinessSettings;
  paymentSettings: PaymentSettings;
  categories: CategoryItem[];
  products: ProductItem[];
  cakeDesigns: CakeDesignItem[];
  mediaAssets: MediaAssetItem[];
  coupons: CouponItem[];
  deliveryZones: DeliveryZoneItem[];
  diningTables: DiningTableItem[];
  orders: OrderRecord[];
  orderPayments: OrderPaymentRecord[];
  paymentSubmissions: PaymentSubmissionRecord[];
  paymentHistory: PaymentVerificationHistoryRecord[];
  staffMembers?: StaffMemberRecord[];
  roleDefinitions?: RoleDefinitionRecord[];
  inventoryLogs?: InventoryLogRecord[];
  rawMaterials?: RawMaterialRecord[];
  customerCrmNotes?: CustomerCrmNoteRecord[];
  websiteConfig?: WebsiteConfigRecord;
  customPages?: CustomPageRecord[];
  adminNotifications?: AdminNotificationRecord[];
  auditLogs?: AuditLogRecord[];
  backupRecords?: BackupRecordItem[];
  onPasswordAuthSuccess?: (account: StaffMemberRecord, token: string) => void;
}

const ORDER_STATUSES = [
  'awaiting_advance_payment',
  'AWAITING_PAYMENT_VERIFICATION',
  'payment_rejected',
  'resubmission_requested',
  'new_order',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'awaiting_quote',
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentPath,
  onNavigate,
  userEmail,
  isAdminUser,
  onSignIn,
  onSignOut,
  settings,
  paymentSettings,
  categories,
  products,
  cakeDesigns,
  mediaAssets,
  coupons,
  deliveryZones,
  diningTables,
  orders,
  orderPayments,
  paymentSubmissions,
  paymentHistory,
  staffMembers = INITIAL_STAFF_MEMBERS,
  roleDefinitions = INITIAL_ROLE_DEFINITIONS,
  inventoryLogs = [],
  rawMaterials = [],
  customerCrmNotes = [],
  websiteConfig = INITIAL_WEBSITE_CONFIG,
  customPages = INITIAL_CUSTOM_PAGES,
  adminNotifications = [],
  auditLogs = [],
  backupRecords = [],
  onPasswordAuthSuccess,
}) => {
  // Determine active admin tab from URL path
  const rawSubPath = currentPath.replace(/^\/admin\/?/, '') || 'overview';
  const subPath = rawSubPath === 'login' ? 'overview' : rawSubPath;

  // Collapsible Sidebar, Global Search & Notifications Drawer State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  // Inactivity Timeout & Password-Only Authentication State
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(() => {
    const saved = Number(localStorage.getItem('loveys_admin_inactivity_mins'));
    return saved >= 15 ? saved : 30;
  });

  const [passwordSessionToken, setPasswordSessionToken] = useState<string>(() => {
    return (
      sessionStorage.getItem('loveys_admin_session_token') ||
      localStorage.getItem('loveys_admin_session_token') ||
      ''
    );
  });
  const [passwordAuthAccount, setPasswordAuthAccount] = useState<StaffMemberRecord | null>(null);
  const [ownerConfigured, setOwnerConfigured] = useState<boolean>(true);
  const [authStatusLoading, setAuthStatusLoading] = useState<boolean>(true);

  // Login Form State (/admin/login)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // First-Run Owner Setup State (when ownerConfigured === false)
  const [setupOwnerUsername, setSetupOwnerUsername] = useState('owner');
  const [setupOwnerName, setSetupOwnerName] = useState("Lovey's Principal Owner");
  const [setupOwnerPassword, setSetupOwnerPassword] = useState('');
  const [setupOwnerConfirmPassword, setSetupOwnerConfirmPassword] = useState('');

  // Forgot Password / Single-Use Recovery Link State (NEVER OTP)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotResult, setForgotResult] = useState<{
    message: string;
    recoveryLinkPath?: string | null;
  } | null>(null);

  // Single-Use Reset Token from URL (?resetToken=...&email=...)
  const [urlResetToken, setUrlResetToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('resetToken') || '';
  });
  const [urlResetEmail, setUrlResetEmail] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || '';
  });
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // First-Login Mandatory Password Change State
  const [firstLoginOldPassword, setFirstLoginOldPassword] = useState('');
  const [firstLoginNewPassword, setFirstLoginNewPassword] = useState('');
  const [firstLoginConfirmPassword, setFirstLoginConfirmPassword] = useState('');

  // Second-Password Step-Up Verification Modal for Critical Owner Actions (Never OTP)
  const [stepUpModal, setStepUpModal] = useState<{
    actionLabel: string;
    onVerified: () => void;
  } | null>(null);
  const [stepUpInput, setStepUpInput] = useState('');
  const [showStepUpPassword, setShowStepUpPassword] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  // Dashboard filters
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderFulfilmentFilter, setOrderFulfilmentFilter] = useState('all');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderRecord | null>(null);
  const [inspectingOrderDetail, setInspectingOrderDetail] = useState<OrderRecord | null>(null);

  // Payment Verification Dashboard (/admin/payments) State
  const [paymentTabFilter, setPaymentTabFilter] = useState<
    'all' | 'awaiting' | 'submitted' | 'verified' | 'rejected' | 'expired'
  >('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [inspectingScreenshotOrder, setInspectingScreenshotOrder] =
    useState<OrderPaymentRecord | null>(null);
  const [rejectModalOrder, setRejectModalOrder] = useState<{
    record: OrderPaymentRecord;
    mode: 'REJECTED' | 'RESUBMISSION_REQUESTED';
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [internalNoteInputs, setInternalNoteInputs] = useState<Record<string, string>>({});
  const [paymentActionBanner, setPaymentActionBanner] = useState<string | null>(null);

  // Owner Advance Payment Settings (/admin/settings/payments) State
  const [localPaymentSettings, setLocalPaymentSettings] = useState<PaymentSettings>(
    paymentSettings || INITIAL_PAYMENT_SETTINGS
  );
  const [qrUploading, setQrUploading] = useState(false);
  const [paymentSettingsSavedMsg, setPaymentSettingsSavedMsg] = useState<string | null>(null);
  const [paymentSettingsErrorMsg, setPaymentSettingsErrorMsg] = useState<string | null>(null);

  // Product Form Modal & CSV Bulk Import State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [showArchivedProducts, setShowArchivedProducts] = useState(false);
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false);
  const [csvTextInput, setCsvTextInput] = useState('');
  const [csvValidationResult, setCsvValidationResult] = useState<{
    validCount: number;
    errorCount: number;
    validRows: any[];
    rowErrors: Array<{ rowNumber: number; message: string }>;
  } | null>(null);
  const [productActionBanner, setProductActionBanner] = useState<string | null>(null);

  // Category Form State
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);

  // Custom Cake Design Form State
  const [editingCakeDesign, setEditingCakeDesign] = useState<CakeDesignItem | null>(null);

  // Media Asset Uploader State (Firebase Storage + Firestore media_assets)
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaSection, setMediaSection] = useState<
    'gallery' | 'hero' | 'custom_cakes' | 'products' | 'banners'
  >('gallery');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaAspectRatio, setMediaAspectRatio] = useState('4:3');
  const [mediaImageUrl, setMediaImageUrl] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaStatusMsg, setMediaStatusMsg] = useState<string | null>(null);

  // Coupon Form State
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'flat'>('percentage');
  const [newCouponValue, setNewCouponValue] = useState(10);
  const [newCouponMinCart, setNewCouponMinCart] = useState(400);

  // Business Settings & Editable 'Our Story' Form State
  const [localSettings, setLocalSettings] = useState<BusinessSettings>(settings);
  const [settingsSavedBanner, setSettingsSavedBanner] = useState(false);

  // Delivery Zone Form State
  const [newZonePin, setNewZonePin] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneFee, setNewZoneFee] = useState(30);
  const [newZoneMin, setNewZoneMin] = useState(299);
  const [newZoneServiceable, setNewZoneServiceable] = useState(true);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (paymentSettings) {
      setLocalPaymentSettings(paymentSettings);
    }
  }, [paymentSettings]);

  // Check Server-Side Password Authentication Session Status on Mount
  useEffect(() => {
    let active = true;
    const verifyAuthStatus = async () => {
      try {
        const res = await fetch('/api/admin/auth/status', {
          headers: passwordSessionToken
            ? { Authorization: `Bearer ${passwordSessionToken}` }
            : {},
        });
        const data = await res.json();
        if (!active) return;
        setOwnerConfigured(Boolean(data.ownerConfigured));
        if (data.authenticated && data.account) {
          setPasswordAuthAccount(data.account);
          if (onPasswordAuthSuccess) {
            onPasswordAuthSuccess(data.account, passwordSessionToken);
          }
        } else {
          setPasswordAuthAccount(null);
        }
      } catch (err) {
        console.warn('Auth status check:', err);
      } finally {
        if (active) setAuthStatusLoading(false);
      }
    };
    verifyAuthStatus();
    return () => {
      active = false;
    };
  }, [passwordSessionToken]);

  const effectiveAdminEmail =
    passwordAuthAccount?.email || (isAdminUser ? userEmail : null) || null;
  const isPasswordOrFirebaseAuthenticated =
    Boolean(passwordAuthAccount && passwordAuthAccount.status === 'active') ||
    Boolean(userEmail && isAdminUser);

  // Identify current Staff Member & RBAC Role
  const currentStaffMember: StaffMemberRecord =
    passwordAuthAccount ||
    staffMembers.find(
      (s) => s.email.toLowerCase() === (effectiveAdminEmail || '').toLowerCase()
    ) ||
    INITIAL_STAFF_MEMBERS[0];

  const currentRoleDef: RoleDefinitionRecord =
    roleDefinitions.find((r) => r.id === currentStaffMember.roleId) ||
    INITIAL_ROLE_DEFINITIONS[0];

  const hasPermission = (perm: string): boolean => {
    if ((effectiveAdminEmail || '').toLowerCase() === 'prabhve5@gmail.com') return true;
    const summary =
      currentStaffMember.permissionsSummary || currentRoleDef.permissionsSummary || '';
    return summary
      .split(',')
      .map((p) => p.trim())
      .includes(perm);
  };

  // Helper to write immutable Audit Log entries to /audit_logs
  const recordAuditLog = async (
    entityType: string,
    action: string,
    entityId: string,
    summary: string
  ) => {
    if (!effectiveAdminEmail) return;
    try {
      const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry: AuditLogRecord = {
        id,
        actorEmail: effectiveAdminEmail,
        actorRole: currentStaffMember.roleName || currentRoleDef.name,
        action,
        entityType,
        entityId,
        summary,
        outcome: 'success',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'audit_logs', id), entry);
    } catch {
      // Non-blocking audit log write
    }
  };

  const handlePasswordSignOut = async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(passwordSessionToken ? { Authorization: `Bearer ${passwordSessionToken}` } : {}),
        },
      });
    } catch {
      // ignore network error on logout
    }
    sessionStorage.removeItem('loveys_admin_session_token');
    localStorage.removeItem('loveys_admin_session_token');
    setPasswordSessionToken('');
    setPasswordAuthAccount(null);
    onSignOut();
    onNavigate('/admin/login');
  };

  // Inactivity Auto-Logout Timer
  useEffect(() => {
    if (!isPasswordOrFirebaseAuthenticated) return;
    let timerId: number;
    const resetTimer = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        handlePasswordSignOut();
      }, inactivityMinutes * 60 * 1000);
    };
    resetTimer();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    return () => {
      window.clearTimeout(timerId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isPasswordOrFirebaseAuthenticated, inactivityMinutes]);

  const handleChangeInactivityMinutes = (mins: number) => {
    setInactivityMinutes(mins);
    localStorage.setItem('loveys_admin_inactivity_mins', String(mins));
  };

  // Second-Password Step-Up Verification Trigger for Critical Owner Actions (Never OTP)
  const requestStepUpVerification = (actionLabel: string, onVerified: () => void) => {
    setStepUpModal({ actionLabel, onVerified });
    setStepUpInput('');
    setShowStepUpPassword(false);
    setStepUpError(null);
  };

  const handleConfirmStepUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepUpModal) return;
    setStepUpError(null);

    try {
      const res = await fetch('/api/admin/auth/reauthenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(passwordSessionToken ? { Authorization: `Bearer ${passwordSessionToken}` } : {}),
        },
        body: JSON.stringify({ password: stepUpInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setStepUpError(
          data.error || 'Password confirmation failed. Please enter your current admin password.'
        );
        return;
      }

      const callback = stepUpModal.onVerified;
      setStepUpModal(null);
      setStepUpInput('');
      callback();
    } catch (err: any) {
      setStepUpError(err.message || 'Password verification failed.');
    }
  };

  // Handler 1: First-Run Principal Owner Password Setup (/api/admin/auth/bootstrap-owner)
  const handleBootstrapOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (setupOwnerPassword.length < 12) {
      setLoginError('Owner password must be at least 12 characters long.');
      return;
    }
    if (setupOwnerPassword !== setupOwnerConfirmPassword) {
      setLoginError('Password and confirmation do not match.');
      return;
    }
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/bootstrap-owner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: 'prabhve5@gmail.com',
          username: setupOwnerUsername.trim() || 'owner',
          name: setupOwnerName.trim() || "Lovey's Principal Owner",
          password: setupOwnerPassword,
          rememberDevice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Failed to configure owner password.');
        return;
      }

      const token = String(data.sessionToken || '');
      if (rememberDevice) {
        localStorage.setItem('loveys_admin_session_token', token);
      } else {
        sessionStorage.setItem('loveys_admin_session_token', token);
      }
      setPasswordSessionToken(token);
      setPasswordAuthAccount(data.account);
      setOwnerConfigured(true);
      if (onPasswordAuthSuccess) {
        onPasswordAuthSuccess(data.account, token);
      }
      if (rawSubPath === 'login') {
        onNavigate('/admin');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Initial setup failed.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handler 2: Standard Password-Only Admin Login (/api/admin/auth/login)
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccessMsg(null);
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
          rememberDevice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Invalid email/username or password.');
        return;
      }

      const token = String(data.sessionToken || '');
      if (rememberDevice) {
        localStorage.setItem('loveys_admin_session_token', token);
      } else {
        sessionStorage.setItem('loveys_admin_session_token', token);
      }
      setFirstLoginOldPassword(loginPassword);
      setLoginPassword('');
      setPasswordSessionToken(token);
      setPasswordAuthAccount(data.account);
      if (onPasswordAuthSuccess) {
        onPasswordAuthSuccess(data.account, token);
      }
      if (rawSubPath === 'login') {
        onNavigate('/admin');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login request failed.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handler 3: Forgot Password — Generate Single-Use 15-Minute Recovery Link (NEVER OTP)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setForgotResult(null);
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email: forgotEmailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Unable to process password recovery request.');
        return;
      }
      setForgotResult({
        message: data.message,
        recoveryLinkPath: data.recoveryLinkPath,
      });
    } catch (err: any) {
      setLoginError(err.message || 'Password recovery request failed.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handler 4: Complete Single-Use Recovery Link Password Reset
  const handleResetPasswordWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (resetNewPassword.length < 12) {
      setLoginError('New password must be at least 12 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setLoginError('New password and confirmation do not match.');
      return;
    }
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: urlResetEmail,
          resetToken: urlResetToken,
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Password reset failed.');
        return;
      }
      setUrlResetToken('');
      setUrlResetEmail('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      window.history.replaceState({}, '', '/admin/login');
      setLoginIdentifier(urlResetEmail);
      setLoginSuccessMsg(
        data.message || 'Password reset complete! Please sign in with your new password.'
      );
    } catch (err: any) {
      setLoginError(err.message || 'Password reset failed.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handler 5: Mandatory First-Login Password Change for Newly Provisioned Staff
  const handleMandatoryFirstLoginPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (firstLoginNewPassword.length < 12) {
      setLoginError('New password must be at least 12 characters long.');
      return;
    }
    if (firstLoginNewPassword !== firstLoginConfirmPassword) {
      setLoginError('New password and confirmation do not match.');
      return;
    }
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(passwordSessionToken ? { Authorization: `Bearer ${passwordSessionToken}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: firstLoginOldPassword,
          newPassword: firstLoginNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Failed to update initial password.');
        return;
      }
      if (data.sessionToken) {
        sessionStorage.setItem('loveys_admin_session_token', data.sessionToken);
        setPasswordSessionToken(data.sessionToken);
      }
      if (data.account) {
        setPasswordAuthAccount(data.account);
      }
      setFirstLoginOldPassword('');
      setFirstLoginNewPassword('');
      setFirstLoginConfirmPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Failed to update initial password.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // ============================================================================
  // PROTECTED PASSWORD-ONLY ADMIN LOGIN GATE (/admin/login or unauthenticated /admin/*)
  // ============================================================================
  if (
    rawSubPath === 'login' ||
    !isPasswordOrFirebaseAuthenticated ||
    currentStaffMember.status === 'suspended' ||
    Boolean(passwordAuthAccount?.requirePasswordChange)
  ) {
    // Redirect unauthenticated /admin/* paths cleanly to /admin/login in the address bar
    if (
      !isPasswordOrFirebaseAuthenticated &&
      rawSubPath !== 'login' &&
      !urlResetToken &&
      !authStatusLoading
    ) {
      window.history.replaceState({}, '', '/admin/login');
    }

    // If already authenticated with no pending password change and user visited /admin/login, let them proceed or sign in
    if (
      isPasswordOrFirebaseAuthenticated &&
      rawSubPath === 'login' &&
      !passwordAuthAccount?.requirePasswordChange &&
      !urlResetToken
    ) {
      return (
        <div className="min-h-[85vh] bg-[#FFF8F1] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E6D7C8] rounded-3xl p-8 text-center shadow-md space-y-5">
            <span className="px-3 py-1 rounded-lg bg-[#2D6A4F] text-white text-[10px] font-bold uppercase tracking-[0.2em]">
              Active Admin Session
            </span>
            <h1 className="font-serif text-2xl font-bold text-[#3B2824]">
              Signed in as {currentStaffMember.name}
            </h1>
            <p className="text-xs text-[#6B544E] font-mono-num">
              {effectiveAdminEmail} · {currentStaffMember.roleName}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="w-full py-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-bold hover:bg-[#B94E62]"
              >
                Continue to Admin Dashboard &rarr;
              </button>
              <button
                type="button"
                onClick={handlePasswordSignOut}
                className="w-full py-2.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold text-[#B94E62]"
              >
                Sign Out of This Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[88vh] bg-[#FFF8F1] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E6D7C8] rounded-3xl p-8 shadow-md space-y-5">
          <div className="text-center">
            <span className="px-3 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-[0.2em]">
              Lovey&apos;s Enterprise BMS · Password-Only Login
            </span>
            <h1 className="font-serif text-3xl font-bold text-[#3B2824] mt-3">
              {urlResetToken
                ? 'Reset Admin Password'
                : passwordAuthAccount?.requirePasswordChange
                ? 'Set Your New Password'
                : !ownerConfigured
                ? 'Initial Owner Password Setup'
                : forgotPasswordOpen
                ? 'Account Password Recovery'
                : 'Admin & Staff Login'}
            </h1>
            <p className="text-xs text-[#6B544E] mt-1.5 leading-relaxed">
              Lovey&apos;s Bakery &amp; Pizza Corners (लवी&apos;स बेकरी &amp; पिज्जा कॉर्नर्स) · Renukoot, Sonbhadra
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-2xl bg-[#FFF5F5] border border-[#B94E62]/40 text-xs text-[#B94E62] font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          {loginSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-[#E8F5E9] border border-[#2D6A4F]/40 text-xs text-[#2D6A4F] font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginSuccessMsg}</span>
            </div>
          )}

          {/* CASE A: Single-Use Recovery Link Password Reset (?resetToken=...&email=...) */}
          {urlResetToken ? (
            <form onSubmit={handleResetPasswordWithToken} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                <p className="font-bold text-[#3B2824]">
                  Single-Use Recovery Link for {urlResetEmail}
                </p>
                <p className="text-[11px] text-[#6B544E] mt-0.5">
                  Choose a strong new password (minimum 12 characters or multi-word passphrase). Submitting will invalidate all previous sessions.
                </p>
              </div>

              <div>
                <label className="block font-bold mb-1">New Password (Min 12 Characters)</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 12 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Confirm New Password</label>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-3 rounded-xl bg-[#2D6A4F] text-white font-bold hover:bg-[#23533D]"
              >
                {loginSubmitting ? 'Resetting Password...' : 'Save New Password & Revoke Old Sessions'}
              </button>
            </form>
          ) : passwordAuthAccount?.requirePasswordChange ? (
            /* CASE B: Mandatory First-Login Password Change for Newly Created Staff Account */
            <form
              onSubmit={handleMandatoryFirstLoginPasswordChange}
              className="space-y-4 text-xs"
            >
              <div className="p-3 rounded-xl bg-[#FFF4E5] border border-[#B36B00]/30 text-[#B36B00]">
                <p className="font-bold">Mandatory First-Login Password Update</p>
                <p className="text-[11px] mt-0.5">
                  Welcome, <strong>{passwordAuthAccount.name}</strong>. For your security, please replace your temporary initial password with a personal 12+ character password.
                </p>
              </div>

              <div>
                <label className="block font-bold mb-1">Current Temporary Password</label>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={firstLoginOldPassword}
                  onChange={(e) => setFirstLoginOldPassword(e.target.value)}
                  placeholder="Enter your temporary password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">New Personal Password (Min 12 Chars)</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={firstLoginNewPassword}
                    onChange={(e) => setFirstLoginNewPassword(e.target.value)}
                    placeholder="At least 12 characters or passphrase"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Confirm New Password</label>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={firstLoginConfirmPassword}
                  onChange={(e) => setFirstLoginConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-bold hover:bg-[#B94E62]"
              >
                {loginSubmitting ? 'Updating Password...' : 'Update Password & Enter Dashboard'}
              </button>
            </form>
          ) : !ownerConfigured ? (
            /* CASE C: First-Run Owner Password Setup (when ADMIN_OWNER_PASSWORD is unset and unclaimed) */
            <form onSubmit={handleBootstrapOwnerSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                <p className="font-bold text-[#3B2824]">
                  One-Time Principal Owner Password Claim
                </p>
                <p className="text-[11px] text-[#6B544E] mt-0.5">
                  Configure the master password for <strong>prabhve5@gmail.com</strong> (minimum 12 characters). Once claimed, this setup screen permanently locks.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Owner Email</label>
                  <input
                    type="email"
                    disabled
                    value="prabhve5@gmail.com"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#F5EBE1] font-mono-num text-[#6B544E]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Admin Username</label>
                  <input
                    type="text"
                    required
                    value={setupOwnerUsername}
                    onChange={(e) => setSetupOwnerUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Owner Display Name</label>
                <input
                  type="text"
                  required
                  value={setupOwnerName}
                  onChange={(e) => setSetupOwnerName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Create Master Password (Min 12 Characters)
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    value={setupOwnerPassword}
                    onChange={(e) => setSetupOwnerPassword(e.target.value)}
                    placeholder="Enter 12+ character password or passphrase"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Confirm Master Password</label>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={setupOwnerConfirmPassword}
                  onChange={(e) => setSetupOwnerConfirmPassword(e.target.value)}
                  placeholder="Re-enter master password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>

              <label className="flex items-center gap-2 font-semibold text-[#3B2824]">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                />
                Remember This Device (14-day persistent session)
              </label>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-bold hover:bg-[#B94E62] flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {loginSubmitting
                  ? 'Configuring Owner Account...'
                  : 'Save Owner Password & Unlock BMS'}
              </button>
            </form>
          ) : forgotPasswordOpen ? (
            /* CASE D: Forgot Password Flow (Single-Use 15-Minute Recovery Link — NEVER OTP) */
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                <p className="font-bold text-[#3B2824]">
                  Single-Use Password Recovery Link
                </p>
                <p className="text-[11px] text-[#6B544E] mt-0.5">
                  Enter your registered admin or staff email address. A time-limited (15-minute), single-use password reset link will be generated.
                </p>
              </div>

              <div>
                <label className="block font-bold mb-1">Registered Admin / Staff Email</label>
                <input
                  type="email"
                  required
                  value={forgotEmailInput}
                  onChange={(e) => setForgotEmailInput(e.target.value)}
                  placeholder="prabhve5@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
              </div>

              {forgotResult && (
                <div className="p-3.5 rounded-2xl bg-[#E8F5E9] border border-[#2D6A4F]/30 space-y-2">
                  <p className="font-semibold text-[#2D6A4F]">{forgotResult.message}</p>
                  {forgotResult.recoveryLinkPath && (
                    <div className="pt-1 border-t border-[#2D6A4F]/20 space-y-1.5">
                      <p className="text-[11px] font-bold text-[#3B2824]">
                        Direct Single-Use Recovery Link (Expires in 15 mins):
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams(
                            forgotResult.recoveryLinkPath!.split('?')[1] || ''
                          );
                          setUrlResetToken(params.get('resetToken') || '');
                          setUrlResetEmail(params.get('email') || '');
                          setForgotPasswordOpen(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-[#2D6A4F] text-white font-bold text-center"
                      >
                        Open Single-Use Password Reset Screen &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="w-full py-3 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-bold hover:bg-[#B94E62]"
                >
                  {loginSubmitting ? 'Issuing Recovery Link...' : 'Send Single-Use Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordOpen(false);
                    setForgotResult(null);
                    setLoginError(null);
                  }}
                  className="w-full py-2.5 rounded-xl border border-[#E6D7C8] font-semibold"
                >
                  &larr; Back to Password Login
                </button>
              </div>
            </form>
          ) : (
            /* CASE E: Standard Password-Only Admin Login (/admin/login) */
            <form onSubmit={handlePasswordLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-[#3B2824]">
                  Admin Email or Username
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="prabhve5@gmail.com or owner"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#3B2824]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordOpen(true);
                      setForgotEmailInput(
                        loginIdentifier.includes('@') ? loginIdentifier : 'prabhve5@gmail.com'
                      );
                      setLoginError(null);
                    }}
                    className="text-[11px] font-bold text-[#B94E62] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your 12+ character password"
                    className="w-full pl-3.5 pr-16 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#6B544E] hover:text-[#3B2824] flex items-center gap-1"
                  >
                    {showLoginPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Show
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-semibold text-[#3B2824] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                  />
                  Remember This Device
                </label>
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-sm font-semibold hover:bg-[#B94E62] transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {loginSubmitting ? 'Verifying Password...' : 'Secure Login'}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="w-full py-2.5 rounded-xl border border-[#E6D7C8] text-[#3B2824] font-semibold hover:bg-[#F5EBE1] transition-colors"
              >
                Return to Public Storefront
              </button>
            </form>
          )}

          <p className="text-[11px] text-[#6B544E] text-center pt-2 border-t border-[#E6D7C8]">
            Protected by 12+ character Scrypt password hashing, brute-force lockout, progressive delays, and Role-Based Access Control (RBAC).
          </p>
        </div>
      </div>
    );
  }

  // Filter orders by date range
  const nowMs = Date.now();
  const dateFilteredOrders = orders.filter((o) => {
    if (dateRangeFilter === 'all') return true;
    const createdMs = new Date(o.createdAt).getTime();
    if (Number.isNaN(createdMs)) return true;
    const diffDays = (nowMs - createdMs) / (1000 * 60 * 60 * 24);
    if (dateRangeFilter === 'today') return diffDays <= 1;
    if (dateRangeFilter === '7days') return diffDays <= 7;
    if (dateRangeFilter === '30days') return diffDays <= 30;
    return true;
  });

  // Strict Financial KPIs: Never count unverified or cancelled orders as Verified Revenue
  const verifiedOrdersList = dateFilteredOrders.filter(
    (o) =>
      o.orderStatus !== 'cancelled' &&
      o.orderStatus !== 'awaiting_advance_payment' &&
      o.orderStatus !== 'AWAITING_PAYMENT_VERIFICATION' &&
      o.orderStatus !== 'payment_rejected' &&
      o.orderStatus !== 'resubmission_requested'
  );
  const totalRevenue = verifiedOrdersList.reduce(
    (acc, o) => acc + Number(o.totalAmount || 0),
    0
  );
  const verifiedAdvanceTotal = orderPayments
    .filter((p) => p.paymentStatus === 'VERIFIED')
    .reduce((acc, p) => acc + Number(p.verifiedAdvanceAmount || 0), 0);
  const pendingVerificationCount = orderPayments.filter(
    (p) => p.paymentStatus === 'PAYMENT_SUBMITTED'
  ).length;
  const pendingOrdersCount = dateFilteredOrders.filter((o) =>
    ['new_order', 'confirmed', 'preparing'].includes(o.orderStatus)
  ).length;
  const customCakeOrdersCount = dateFilteredOrders.filter(
    (o) => Boolean(o.customCakeDetails) || o.orderStatus === 'awaiting_quote'
  ).length;
  const lowStockItemsCount = products.filter(
    (p) => !p.isArchived && Number(p.stockQuantity ?? 0) <= Number(p.minStockThreshold ?? 5)
  ).length;

  // Build prefilled WhatsApp click-to-chat URL for customer communication
  const buildCustomerWhatsAppUrl = (order: OrderRecord, statusOverride?: string) => {
    const rawDigits = (order.customerWhatsapp || order.customerPhone || '').replace(/[^\d]/g, '');
    const normalizedPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
    const statusLabel = (statusOverride || order.orderStatus).replace(/_/g, ' ').toUpperCase();
    const message = [
      `Hello ${order.customerName},`,
      `Update from Lovey's Bakery & Pizza Corners (Renukoot):`,
      `Order #${order.orderNumber} status is now *${statusLabel}*.`,
      `Total: ₹${order.totalAmount} (${order.fulfilmentType.replace('_', ' ').toUpperCase()})`,
      `Track live on our website: ${window.location.origin}/order/${order.orderNumber}`,
    ].join('\n');
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  };

  // Update Order Status + Atomic Sync with /order_summaries + Transactional Stock Restoration on Cancellation
  const handleUpdateOrderStatus = async (
    order: OrderRecord,
    newStatus: string,
    updatedTotal?: number,
    adminNote?: string
  ) => {
    try {
      const nowIso = new Date().toISOString();
      const batch = writeBatch(db);
      let shouldMarkStockRestored = Boolean(order.stockRestored);

      // If transitioning to 'cancelled' and stock hasn't been restored yet, restore stock safely once
      if (newStatus === 'cancelled' && order.orderStatus !== 'cancelled' && !order.stockRestored) {
        shouldMarkStockRestored = true;
        let parsedItems: Array<{ productId: string; quantity: number; name?: string }> = [];
        if (order.orderedItemsJson) {
          try {
            parsedItems = JSON.parse(order.orderedItemsJson);
          } catch {
            parsedItems = [];
          }
        }
        for (const item of parsedItems) {
          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            const prevStock = Number(prod.stockQuantity ?? 0);
            const delta = Math.max(1, Number(item.quantity || 1));
            const restoredStock = prevStock + delta;
            batch.set(doc(db, 'products', prod.id), {
              ...prod,
              stockQuantity: restoredStock,
              isAvailable: restoredStock > 0,
            });
            const logId = `invlog-cancel-${order.orderNumber}-${prod.id}`;
            batch.set(doc(db, 'inventory_logs', logId), {
              id: logId,
              entityType: 'product',
              entityId: prod.id,
              entityName: prod.name,
              changeType: 'order_cancel_restore',
              previousStock: prevStock,
              delta,
              newStock: restoredStock,
              reason: `Stock restored on cancellation of Order #${order.orderNumber}`,
              actorEmail: effectiveAdminEmail || 'admin',
              createdAt: nowIso,
            });
          }
        }
      }

      const updatedOrder: OrderRecord = {
        ...order,
        orderStatus: newStatus,
        stockRestored: shouldMarkStockRestored,
        totalAmount: updatedTotal !== undefined ? updatedTotal : order.totalAmount,
        adminNotes: adminNote !== undefined ? adminNote : order.adminNotes || '',
        updatedAt: nowIso,
      };

      batch.set(doc(db, 'orders', order.orderNumber), updatedOrder);
      batch.set(doc(db, 'order_summaries', order.orderNumber), {
        orderNumber: order.orderNumber,
        userId: order.userId || 'guest',
        fulfilmentType: order.fulfilmentType,
        orderStatus: newStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        advanceRequired: Boolean(order.advanceRequired),
        requiredAdvanceAmount: Number(order.requiredAdvanceAmount || 0),
        submittedAdvanceAmount: Number(order.submittedAdvanceAmount || 0),
        verifiedAdvanceAmount: Number(order.verifiedAdvanceAmount || 0),
        remainingBalanceAmount: Number(order.remainingBalanceAmount || 0),
        totalAmount: updatedOrder.totalAmount,
        itemsSummary: order.itemsSummary,
        pickupDate: order.pickupDate || '',
        pickupTimeSlot: order.pickupTimeSlot || '',
        tableNumber: order.tableNumber || '',
        createdAt: order.createdAt,
        updatedAt: nowIso,
      });

      await batch.commit();
      await recordAuditLog(
        'orders',
        'ORDER_STATUS_UPDATED',
        order.orderNumber,
        `Order #${order.orderNumber} -> ${newStatus.toUpperCase()}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.orderNumber}`);
    }
  };

  // Export Orders CSV
  const handleExportOrdersCsv = () => {
    const headers = [
      'OrderNumber',
      'Date',
      'CustomerName',
      'Phone',
      'Fulfilment',
      'Status',
      'PaymentMethod',
      'TotalINR',
      'Items',
    ];
    const rows = dateFilteredOrders.map((o) => [
      o.orderNumber,
      o.createdAt,
      `"${(o.customerName || '').replace(/"/g, '""')}"`,
      o.customerPhone,
      o.fulfilmentType,
      o.orderStatus,
      o.paymentMethod,
      o.totalAmount,
      `"${(o.itemsSummary || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loveys-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save Product (Create or Edit with Size, Flavor, Frosting, and Add-ons)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const toSave: ProductItem = {
        ...editingProduct,
        minStockThreshold: Number(editingProduct.minStockThreshold ?? 5),
        stockQuantity: Number(editingProduct.stockQuantity ?? 20),
      };
      await setDoc(doc(db, 'products', toSave.id), toSave);
      await recordAuditLog(
        'products',
        isNewProduct ? 'PRODUCT_CREATED' : 'PRODUCT_UPDATED',
        toSave.id,
        `${isNewProduct ? 'Created' : 'Updated'} product "${toSave.name}" (₹${toSave.basePrice})`
      );
      setEditingProduct(null);
      setIsNewProduct(false);
      setProductActionBanner(`Saved product "${toSave.name}".`);
      setTimeout(() => setProductActionBanner(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${editingProduct.id}`);
    }
  };

  const handleToggleProductVisibility = async (prod: ProductItem) => {
    try {
      await setDoc(doc(db, 'products', prod.id), {
        ...prod,
        isAvailable: !prod.isAvailable,
      });
      await recordAuditLog(
        'products',
        'PRODUCT_VISIBILITY_TOGGLED',
        prod.id,
        `${prod.name} -> ${!prod.isAvailable ? 'Published' : 'Hidden'}`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${prod.id}`);
    }
  };

  const handleDuplicateProduct = async (prod: ProductItem) => {
    const dupId = `prod-copy-${Date.now()}`;
    const dup: ProductItem = {
      ...prod,
      id: dupId,
      name: `${prod.name} (Copy)`,
      slug: `${prod.slug || prod.id}-copy-${Date.now().toString().slice(-3)}`,
      isAvailable: false,
    };
    try {
      await setDoc(doc(db, 'products', dupId), dup);
      await recordAuditLog('products', 'PRODUCT_DUPLICATED', dupId, `Duplicated ${prod.name}`);
      setProductActionBanner(`Created draft duplicate "${dup.name}".`);
      setTimeout(() => setProductActionBanner(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${dupId}`);
    }
  };

  const handleToggleArchiveProduct = async (prod: ProductItem) => {
    const nextArchived = !prod.isArchived;
    try {
      await setDoc(doc(db, 'products', prod.id), {
        ...prod,
        isArchived: nextArchived,
        isAvailable: nextArchived ? false : prod.isAvailable,
      });
      await recordAuditLog(
        'products',
        nextArchived ? 'PRODUCT_ARCHIVED' : 'PRODUCT_RESTORED',
        prod.id,
        `${nextArchived ? 'Archived' : 'Restored'} product "${prod.name}"`
      );
      setProductActionBanner(
        `"${prod.name}" has been ${nextArchived ? 'moved to Archive' : 'restored to Active Catalogue'}.`
      );
      setTimeout(() => setProductActionBanner(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${prod.id}`);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    try {
      await deleteDoc(doc(db, 'products', prodId));
      await recordAuditLog('products', 'PRODUCT_DELETED', prodId, `Permanently deleted product ${prodId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${prodId}`);
    }
  };

  const handleExportProductsCsv = () => {
    const headers = [
      'id',
      'name',
      'nameHi',
      'categoryId',
      'basePrice',
      'stockQuantity',
      'minStockThreshold',
      'isVeg',
      'isAvailable',
      'badge',
      'imageUrl',
      'description',
    ];
    const rows = products.map((p) =>
      [
        p.id,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.nameHi || '').replace(/"/g, '""')}"`,
        p.categoryId,
        p.basePrice,
        p.stockQuantity ?? 20,
        p.minStockThreshold ?? 5,
        p.isVeg !== false,
        p.isAvailable,
        `"${(p.badge || p.discountLabel || '').replace(/"/g, '""')}"`,
        p.imageUrl,
        `"${(p.description || p.shortDescription || '').replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loveys-products-catalogue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateCsvImport = async () => {
    if (!csvTextInput.trim()) return;
    try {
      const res = await fetch('/api/admin/products/validate-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvTextInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProductActionBanner(data.error || 'CSV validation failed.');
        return;
      }
      setCsvValidationResult(data);
    } catch (err: any) {
      setProductActionBanner(err.message || 'CSV validation failed.');
    }
  };

  const handleCommitCsvImport = async () => {
    if (!csvValidationResult || csvValidationResult.validRows.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const row of csvValidationResult.validRows) {
        const cat = categories.find((c) => c.id === row.categoryId);
        const prodItem: ProductItem = {
          ...row,
          categoryName: cat ? cat.name : row.categoryId,
          shortDescription: row.description,
          fullDescription: row.description,
          variantsSummary: 'Regular:0 | Large:150',
          flavorsSummary: 'Signature Classic:0',
          frostingsSummary: 'Artisan Finish:0',
          addonsSummary: 'Extra Cheese / Topper:50',
        };
        batch.set(doc(db, 'products', prodItem.id), prodItem);
      }
      await batch.commit();
      await recordAuditLog(
        'products',
        'CSV_BULK_IMPORT_APPLIED',
        'products',
        `Bulk imported ${csvValidationResult.validRows.length} products via validated CSV`
      );
      setProductActionBanner(
        `Successfully imported ${csvValidationResult.validRows.length} validated products into Firestore!`
      );
      setCsvImportModalOpen(false);
      setCsvValidationResult(null);
      setCsvTextInput('');
      setTimeout(() => setProductActionBanner(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products/csv_bulk_import');
    }
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await setDoc(doc(db, 'categories', editingCategory.id), editingCategory);
      setEditingCategory(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `categories/${editingCategory.id}`);
    }
  };

  // Save Custom Cake Design
  const handleSaveCakeDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCakeDesign) return;
    try {
      await setDoc(doc(db, 'cake_designs', editingCakeDesign.id), editingCakeDesign);
      setEditingCakeDesign(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cake_designs/${editingCakeDesign.id}`);
    }
  };

  // Handle Media File Upload -> Firebase Storage (with dataURL fallback) -> Firestore media_assets
  const handleMediaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaUploading(true);
    setMediaStatusMsg('Processing image...');

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        setMediaUploading(false);
        return;
      }

      // Compress/resize on client canvas to ensure smooth storage & Firestore compatibility
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1100;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

        // Attempt upload to Firebase Cloud Storage first
        try {
          const fileName = `gallery/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
          const sRef = storageRef(storage, fileName);
          await uploadString(sRef, compressedDataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(sRef);
          setMediaImageUrl(downloadUrl);
          setMediaStatusMsg('Uploaded to Cloud Storage bucket!');
        } catch {
          // Fallback to optimized inline data URL if bucket rules aren't provisioned
          setMediaImageUrl(compressedDataUrl);
          setMediaStatusMsg('Image optimized and ready to publish to Gallery.');
        } finally {
          setMediaUploading(false);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMediaAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaTitle.trim() || !mediaImageUrl.trim()) return;
    const id = `media-${Date.now()}`;
    const newAsset: MediaAssetItem = {
      id,
      title: mediaTitle.trim(),
      section: mediaSection,
      mediaType,
      imageUrl: mediaImageUrl.trim(),
      url: mediaImageUrl.trim(),
      altText: mediaTitle.trim(),
      aspectRatio: mediaAspectRatio,
      isVisible: true,
      displayOrder: mediaAssets.length + 1,
    };
    try {
      await setDoc(doc(db, 'media_assets', id), newAsset);
      setMediaTitle('');
      setMediaImageUrl('');
      setMediaStatusMsg('Published to live gallery!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `media_assets/${id}`);
    }
  };

  // Save Business Settings (including Our Story)
  const handleSaveBusinessSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'business_settings', 'default'), localSettings);
      setSettingsSavedBanner(true);
      setTimeout(() => setSettingsSavedBanner(false), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'business_settings/default');
    }
  };

  // Owner Actual Payment QR Image Upload (/admin/settings/payments)
  const handleQrImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentSettingsErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setPaymentSettingsErrorMsg('Only JPG, JPEG, PNG, and WebP QR code images are supported.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPaymentSettingsErrorMsg('QR image must be under 5 MB.');
      e.target.value = '';
      return;
    }

    setQrUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setQrUploading(false);
        return;
      }
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedQrDataUrl = canvas.toDataURL('image/png', 0.92);

        try {
          const qrStoragePath = `payment_qr/loveys-upi-qr-${Date.now()}.png`;
          const sRef = storageRef(storage, qrStoragePath);
          await uploadString(sRef, compressedQrDataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(sRef);
          setLocalPaymentSettings((prev) => ({
            ...prev,
            qrCodeImageUrl: downloadUrl,
          }));
        } catch {
          setLocalPaymentSettings((prev) => ({
            ...prev,
            qrCodeImageUrl: compressedQrDataUrl,
          }));
        } finally {
          setQrUploading(false);
        }
      };
      img.onerror = () => {
        setQrUploading(false);
        setPaymentSettingsErrorMsg('Invalid image file selected.');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Save Owner Advance Payment Settings with Mandatory QR & UPI Validation
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSettingsErrorMsg(null);
    setPaymentSettingsSavedMsg(null);

    const isMandatoryActive =
      localPaymentSettings.mandatoryForDelivery || localPaymentSettings.mandatoryForPickup;

    if (isMandatoryActive) {
      if (!localPaymentSettings.upiId.trim() || !localPaymentSettings.payeeDisplayName.trim()) {
        setPaymentSettingsErrorMsg(
          'Validation Error: You must configure a valid UPI ID and Payee Display Name before enabling mandatory advance payments.'
        );
        return;
      }
      if (!localPaymentSettings.qrCodeImageUrl || localPaymentSettings.qrCodeImageUrl.trim().length < 5) {
        setPaymentSettingsErrorMsg(
          'Validation Error: Please upload your actual payment QR code image before enabling mandatory manual UPI payments for Home Delivery or Takeaway/Parcel.'
        );
        return;
      }
    }

    try {
      const updated: PaymentSettings = {
        ...localPaymentSettings,
        upiId: localPaymentSettings.upiId.trim(),
        payeeDisplayName: localPaymentSettings.payeeDisplayName.trim(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'payment_settings', 'default'), updated);
      setPaymentSettingsSavedMsg(
        'Advance payment settings, calculation rules, and owner UPI QR code saved!'
      );
      setTimeout(() => setPaymentSettingsSavedMsg(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'payment_settings/default');
    }
  };

  // Admin Action 1: Verify Advance Payment -> Marks VERIFIED, calculates remaining balance, moves order to confirmed
  const handleVerifyAdvancePayment = async (rec: OrderPaymentRecord) => {
    try {
      const nowIso = new Date().toISOString();
      const verifiedAmt =
        rec.submittedAmount > 0 ? rec.submittedAmount : rec.requiredAdvanceAmount;
      const remainingAmt = Math.max(0, rec.totalOrderAmount - verifiedAmt);
      const histId = `hist-verify-${rec.orderNumber}-${Date.now()}`;

      const batch = writeBatch(db);

      // 1. Update order_payments/{orderNumber}
      batch.set(doc(db, 'order_payments', rec.orderNumber), {
        ...rec,
        verifiedAdvanceAmount: verifiedAmt,
        remainingBalanceAmount: remainingAmt,
        paymentStatus: 'VERIFIED',
        rejectionReason: '',
        verifiedByEmail: userEmail || 'admin',
        verifiedAt: nowIso,
        updatedAt: nowIso,
      });

      // 2. Update latest payment_submissions document if present
      if (rec.latestSubmissionId) {
        const subDoc = paymentSubmissions.find((s) => s.id === rec.latestSubmissionId);
        if (subDoc) {
          batch.set(doc(db, 'payment_submissions', subDoc.id), {
            ...subDoc,
            verificationStatus: 'VERIFIED',
            reviewedByEmail: userEmail || 'admin',
            reviewedAt: nowIso,
          });
        }
      }

      // 3. Update orders/{orderNumber} and order_summaries/{orderNumber}
      const matchingOrder = orders.find((o) => o.orderNumber === rec.orderNumber);
      if (matchingOrder) {
        const updatedOrder: OrderRecord = {
          ...matchingOrder,
          orderStatus: 'confirmed',
          paymentStatus: remainingAmt === 0 ? 'paid' : 'advance_verified',
          verifiedAdvanceAmount: verifiedAmt,
          remainingBalanceAmount: remainingAmt,
          paymentRejectionReason: '',
          updatedAt: nowIso,
        };
        batch.set(doc(db, 'orders', rec.orderNumber), updatedOrder);
        batch.set(doc(db, 'order_summaries', rec.orderNumber), {
          orderNumber: rec.orderNumber,
          userId: matchingOrder.userId || 'guest',
          fulfilmentType: matchingOrder.fulfilmentType,
          orderStatus: 'confirmed',
          paymentMethod: matchingOrder.paymentMethod,
          paymentStatus: remainingAmt === 0 ? 'paid' : 'advance_verified',
          advanceRequired: true,
          requiredAdvanceAmount: rec.requiredAdvanceAmount,
          submittedAdvanceAmount: verifiedAmt,
          verifiedAdvanceAmount: verifiedAmt,
          remainingBalanceAmount: remainingAmt,
          totalAmount: matchingOrder.totalAmount,
          itemsSummary: matchingOrder.itemsSummary,
          pickupDate: matchingOrder.pickupDate || '',
          pickupTimeSlot: matchingOrder.pickupTimeSlot || '',
          tableNumber: matchingOrder.tableNumber || '',
          createdAt: matchingOrder.createdAt,
          updatedAt: nowIso,
        });
      }

      // 4. Write audit log to payment_verification_history
      batch.set(doc(db, 'payment_verification_history', histId), {
        id: histId,
        orderNumber: rec.orderNumber,
        submissionId: rec.latestSubmissionId || '',
        action: 'PAYMENT_VERIFIED',
        actorRole: 'admin',
        actorIdentifier: userEmail || 'admin',
        amount: verifiedAmt,
        utrNumber: rec.latestUtrNumber || '',
        note: `Advance payment of ₹${verifiedAmt} (UTR: ${
          rec.latestUtrNumber || 'Manual'
        }) verified by ${userEmail}. Order confirmed for preparation. Remaining balance: ₹${remainingAmt}.`,
        createdAt: nowIso,
      });

      await batch.commit();
      setPaymentActionBanner(
        `Verified ₹${verifiedAmt} advance for Order #${rec.orderNumber}! Order moved to CONFIRMED.`
      );
      setTimeout(() => setPaymentActionBanner(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `order_payments/${rec.orderNumber}`);
    }
  };

  // Admin Action 2 & 3: Reject Payment OR Request New Screenshot
  const handleConfirmRejectOrResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalOrder) return;
    const reason = rejectionReasonInput.trim();
    if (!reason) return;

    const { record: rec, mode } = rejectModalOrder;
    try {
      const nowIso = new Date().toISOString();
      const histId = `hist-reject-${rec.orderNumber}-${Date.now()}`;
      const newOrderStatus =
        mode === 'REJECTED' ? 'payment_rejected' : 'resubmission_requested';

      const batch = writeBatch(db);

      // 1. Update order_payments/{orderNumber}
      batch.set(doc(db, 'order_payments', rec.orderNumber), {
        ...rec,
        paymentStatus: mode,
        rejectionReason: reason,
        updatedAt: nowIso,
      });

      // 2. Update latest payment_submissions document if present
      if (rec.latestSubmissionId) {
        const subDoc = paymentSubmissions.find((s) => s.id === rec.latestSubmissionId);
        if (subDoc) {
          batch.set(doc(db, 'payment_submissions', subDoc.id), {
            ...subDoc,
            verificationStatus: mode,
            rejectionReason: reason,
            reviewedByEmail: userEmail || 'admin',
            reviewedAt: nowIso,
          });
        }
      }

      // 3. Keep order unconfirmed and record rejection reason on orders & order_summaries
      const matchingOrder = orders.find((o) => o.orderNumber === rec.orderNumber);
      if (matchingOrder) {
        batch.set(doc(db, 'orders', rec.orderNumber), {
          ...matchingOrder,
          orderStatus: newOrderStatus,
          paymentStatus: mode,
          paymentRejectionReason: reason,
          updatedAt: nowIso,
        });
        batch.set(doc(db, 'order_summaries', rec.orderNumber), {
          orderNumber: rec.orderNumber,
          userId: matchingOrder.userId || 'guest',
          fulfilmentType: matchingOrder.fulfilmentType,
          orderStatus: newOrderStatus,
          paymentMethod: matchingOrder.paymentMethod,
          paymentStatus: mode,
          advanceRequired: true,
          requiredAdvanceAmount: rec.requiredAdvanceAmount,
          submittedAdvanceAmount: rec.submittedAmount,
          verifiedAdvanceAmount: 0,
          remainingBalanceAmount: rec.remainingBalanceAmount,
          paymentRejectionReason: reason,
          totalAmount: matchingOrder.totalAmount,
          itemsSummary: matchingOrder.itemsSummary,
          pickupDate: matchingOrder.pickupDate || '',
          pickupTimeSlot: matchingOrder.pickupTimeSlot || '',
          tableNumber: matchingOrder.tableNumber || '',
          createdAt: matchingOrder.createdAt,
          updatedAt: nowIso,
        });
      }

      // 4. Write audit log entry
      batch.set(doc(db, 'payment_verification_history', histId), {
        id: histId,
        orderNumber: rec.orderNumber,
        submissionId: rec.latestSubmissionId || '',
        action: mode === 'REJECTED' ? 'PAYMENT_REJECTED' : 'RESUBMISSION_REQUESTED',
        actorRole: 'admin',
        actorIdentifier: userEmail || 'admin',
        amount: rec.submittedAmount,
        utrNumber: rec.latestUtrNumber || '',
        note: `${
          mode === 'REJECTED' ? 'Payment rejected' : 'New screenshot requested'
        } by ${userEmail}. Reason: ${reason}`,
        createdAt: nowIso,
      });

      await batch.commit();
      setRejectModalOrder(null);
      setRejectionReasonInput('');
      setPaymentActionBanner(
        `Order #${rec.orderNumber} marked as ${mode.replace('_', ' ')}. Customer can now upload a new proof.`
      );
      setTimeout(() => setPaymentActionBanner(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `order_payments/${rec.orderNumber}`);
    }
  };

  // Admin Action 4: Add Internal Verification Note
  const handleSaveInternalPaymentNote = async (rec: OrderPaymentRecord) => {
    const noteText = (internalNoteInputs[rec.orderNumber] ?? rec.internalAdminNote ?? '').trim();
    if (!noteText) return;
    try {
      const nowIso = new Date().toISOString();
      const histId = `hist-note-${rec.orderNumber}-${Date.now()}`;
      const batch = writeBatch(db);
      batch.set(doc(db, 'order_payments', rec.orderNumber), {
        ...rec,
        internalAdminNote: noteText,
        updatedAt: nowIso,
      });
      batch.set(doc(db, 'payment_verification_history', histId), {
        id: histId,
        orderNumber: rec.orderNumber,
        action: 'INTERNAL_NOTE_ADDED',
        actorRole: 'admin',
        actorIdentifier: userEmail || 'admin',
        note: `Internal Admin Note: ${noteText}`,
        createdAt: nowIso,
      });
      await batch.commit();
      setPaymentActionBanner(`Saved internal note for Order #${rec.orderNumber}.`);
      setTimeout(() => setPaymentActionBanner(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `order_payments/${rec.orderNumber}`);
    }
  };

  // Create Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    const code = newCouponCode.trim().toUpperCase();
    const id = `coup-${code.toLowerCase()}`;
    const item: CouponItem = {
      id,
      code,
      discountType: newCouponType,
      discountValue: Number(newCouponValue),
      minCartValue: Number(newCouponMinCart),
      maxUsage: 500,
      usedCount: 0,
      expiryDate: '2027-12-31',
      isActive: true,
    };
    try {
      await setDoc(doc(db, 'coupons', id), item);
      setNewCouponCode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `coupons/${id}`);
    }
  };

  // Create Delivery Zone
  const handleCreateDeliveryZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZonePin.trim() || !newZoneName.trim()) return;
    const id = `zone-${Date.now()}`;
    const z: DeliveryZoneItem = {
      id,
      pinCode: newZonePin.trim(),
      localityName: newZoneName.trim(),
      deliveryFee: Number(newZoneFee),
      minOrderAmount: Number(newZoneMin),
      estimatedTime: '35–50 mins',
      isServiceable: newZoneServiceable,
    };
    try {
      await setDoc(doc(db, 'delivery_zones', id), z);
      setNewZonePin('');
      setNewZoneName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `delivery_zones/${id}`);
    }
  };

  const navItems = [
    { id: 'overview', path: '/admin', label: 'Master Dashboard', icon: LayoutDashboard },
    { id: 'orders', path: '/admin/orders', label: 'Orders & Kitchen', icon: ShoppingBag },
    { id: 'payments', path: '/admin/payments', label: 'UPI Verifications', icon: ShieldCheck },
    {
      id: 'settings/payments',
      path: '/admin/settings/payments',
      label: 'Advance UPI Settings',
      icon: CreditCard,
    },
    { id: 'inventory', path: '/admin/inventory', label: 'Inventory & Stock', icon: Layers },
    { id: 'products', path: '/admin/products', label: 'Products & Variants', icon: Package },
    { id: 'categories', path: '/admin/categories', label: 'Categories', icon: FolderTree },
    { id: 'cakes', path: '/admin/cakes', label: 'Custom Cakes Studio', icon: Cake },
    { id: 'website', path: '/admin/website/homepage', label: 'Website CMS Editor', icon: Globe },
    { id: 'media', path: '/admin/media', label: 'Media & Gallery', icon: ImageIcon },
    { id: 'customers', path: '/admin/customers', label: 'Customer CRM', icon: Users },
    { id: 'promotions', path: '/admin/promotions', label: 'Promotions & Coupons', icon: TicketPercent },
    { id: 'fulfilment', path: '/admin/fulfilment', label: 'Fulfilment & PINs', icon: Truck },
    { id: 'tables', path: '/admin/tables', label: 'Dine-In Tables & QR', icon: QrCode },
    { id: 'analytics', path: '/admin/analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'staff', path: '/admin/staff', label: 'Staff & RBAC Roles', icon: Users },
    { id: 'security', path: '/admin/security', label: 'Password & Backups', icon: Shield },
    { id: 'activity-logs', path: '/admin/activity-logs', label: 'Audit Trail Logs', icon: Activity },
    { id: 'settings', path: '/admin/settings', label: 'Store & Our Story', icon: Settings },
    { id: 'help', path: '/admin/help', label: 'Owner Help Manual', icon: HelpCircle },
  ];

  // Unread admin notifications count
  const unreadNotifsCount = adminNotifications.filter((n) => !n.isRead).length;

  // Global search results across Orders, Products, Customers, and UTRs
  const globalSearchResults = globalSearchQuery.trim()
    ? {
        orders: orders
          .filter(
            (o) =>
              o.orderNumber.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
              o.customerName.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
              o.customerPhone.toLowerCase().includes(globalSearchQuery.toLowerCase())
          )
          .slice(0, 4),
        products: products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
              (p.hindiName && p.hindiName.toLowerCase().includes(globalSearchQuery.toLowerCase()))
          )
          .slice(0, 4),
        payments: orderPayments
          .filter(
            (pay) =>
              (pay.latestUtrNumber || '').toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
              pay.orderNumber.toLowerCase().includes(globalSearchQuery.toLowerCase())
          )
          .slice(0, 4),
      }
    : null;

  // Extract unique customers from orders
  const customersMap = new Map<
    string,
    { name: string; phone: string; totalOrders: number; totalSpent: number; lastOrder: string }
  >();
  orders.forEach((o) => {
    const key = o.customerPhone || o.customerName;
    const existing = customersMap.get(key);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpent += Number(o.totalAmount || 0);
    } else {
      customersMap.set(key, {
        name: o.customerName,
        phone: o.customerPhone,
        totalOrders: 1,
        totalSpent: Number(o.totalAmount || 0),
        lastOrder: o.orderNumber,
      });
    }
  });
  const customerList = Array.from(customersMap.values());

  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#3B2824]">
      {/* Second-Password Step-Up Owner Security Verification Modal (Never OTP) */}
      {stepUpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmStepUp}
            className="bg-white border-2 border-[#3B2824] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div>
              <span className="px-2.5 py-1 rounded-lg bg-[#B94E62] text-white text-[10px] font-bold uppercase tracking-wider">
                Second-Password Security Confirmation
              </span>
              <h3 className="font-serif text-xl font-bold text-[#3B2824] mt-2">
                {stepUpModal.actionLabel}
              </h3>
              <p className="text-xs text-[#6B544E] mt-1">
                Re-enter your current admin password for <strong>{effectiveAdminEmail}</strong> to authorize this critical operation.
              </p>
            </div>

            {stepUpError && (
              <div className="p-2.5 rounded-xl bg-[#FFF5F5] text-[#B94E62] text-xs font-semibold">
                {stepUpError}
              </div>
            )}

            <div className="relative">
              <input
                type={showStepUpPassword ? 'text' : 'password'}
                required
                value={stepUpInput}
                onChange={(e) => setStepUpInput(e.target.value)}
                placeholder="Enter your admin password"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
              />
              <button
                type="button"
                onClick={() => setShowStepUpPassword(!showStepUpPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
              >
                {showStepUpPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold hover:bg-[#B94E62]"
              >
                Confirm Password &amp; Execute
              </button>
              <button
                type="button"
                onClick={() => setStepUpModal(null)}
                className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Individual Order Detail Inspector Modal */}
      {inspectingOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6D7C8] rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-start justify-between border-b border-[#E6D7C8] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                  Complete Order Dossier · {inspectingOrderDetail.fulfilmentType.toUpperCase()}
                </span>
                <h3 className="font-serif text-2xl font-bold font-mono-num">
                  Order #{inspectingOrderDetail.orderNumber}
                </h3>
                <p className="text-xs text-[#6B544E]">
                  Placed on {new Date(inspectingOrderDetail.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingOrderDetail(null)}
                className="px-3 py-1.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-1">
                <p className="font-bold uppercase text-[10px] text-[#B94E62]">Customer Details</p>
                <p className="font-bold text-sm">{inspectingOrderDetail.customerName}</p>
                <p className="font-mono-num">Phone: {inspectingOrderDetail.customerPhone}</p>
                {inspectingOrderDetail.customerWhatsapp && (
                  <p className="font-mono-num">WhatsApp: {inspectingOrderDetail.customerWhatsapp}</p>
                )}
                {inspectingOrderDetail.deliveryAddress && (
                  <p className="text-[#6B544E]">
                    Address: {inspectingOrderDetail.deliveryAddress} ({inspectingOrderDetail.pinCode})
                  </p>
                )}
                {inspectingOrderDetail.tableNumber && (
                  <p className="font-bold text-[#2D6A4F]">
                    Dine-In Table: {inspectingOrderDetail.tableNumber}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-1 font-mono-num">
                <p className="font-bold uppercase text-[10px] text-[#B94E62] font-sans">
                  Financial &amp; Advance Summary
                </p>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{inspectingOrderDetail.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-₹{inspectingOrderDetail.discountAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery + Pack + GST:</span>
                  <span>
                    ₹
                    {inspectingOrderDetail.deliveryFee +
                      inspectingOrderDetail.packagingCharge +
                      inspectingOrderDetail.taxAmount}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-[#E6D7C8] pt-1">
                  <span>Total Order Value:</span>
                  <span>₹{inspectingOrderDetail.totalAmount}</span>
                </div>
                {inspectingOrderDetail.advanceRequired && (
                  <>
                    <div className="flex justify-between text-[#2D6A4F] font-bold">
                      <span>Verified Advance Paid:</span>
                      <span>₹{inspectingOrderDetail.verifiedAdvanceAmount ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-[#B94E62] font-bold">
                      <span>Balance Collectable:</span>
                      <span>
                        ₹
                        {inspectingOrderDetail.remainingBalanceAmount ??
                          inspectingOrderDetail.totalAmount}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] text-xs space-y-2">
              <p className="font-bold uppercase text-[10px] text-[#B94E62]">
                Ordered Items &amp; Custom Cake Specifications
              </p>
              <p className="whitespace-pre-line leading-relaxed">
                {inspectingOrderDetail.itemsSummary}
              </p>
              {inspectingOrderDetail.customCakeDetails && (
                <div className="p-2.5 rounded-xl bg-white border border-[#E6D7C8]">
                  <p className="font-bold text-[#3B2824]">Custom Cake Details:</p>
                  <p className="whitespace-pre-line">{inspectingOrderDetail.customCakeDetails}</p>
                </div>
              )}
              {inspectingOrderDetail.specialInstructions && (
                <p className="italic text-[#6B544E]">
                  Special Instructions: {inspectingOrderDetail.specialInstructions}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderForReceipt(inspectingOrderDetail);
                    setInspectingOrderDetail(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Kitchen Receipt
                </button>
                <a
                  href={buildCustomerWhatsAppUrl(inspectingOrderDetail)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold"
                >
                  WhatsApp Customer
                </a>
              </div>
              {inspectingOrderDetail.orderStatus !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateOrderStatus(inspectingOrderDetail, 'cancelled');
                    setInspectingOrderDetail(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#FFF5F5] text-[#B94E62] text-xs font-bold"
                >
                  Cancel Order &amp; Restore Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Overlay when selected */}
      {selectedOrderForReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6D7C8] rounded-2xl max-w-md w-full p-6 shadow-xl print-receipt-only">
            <div className="text-center border-b border-dashed border-[#3B2824] pb-4 mb-4">
              <h2 className="font-serif text-xl font-bold">
                LOVEY&apos;S BAKERY &amp; PIZZA CORNERS
              </h2>
              <p className="text-xs text-[#6B544E]">
                लवी&apos;स बेकरी &amp; पिज्जा कॉर्नर्स · Renukoot, Sonbhadra (231217)
              </p>
              <p className="text-xs font-mono-num mt-0.5">Tel: +91 80905 29971</p>
            </div>

            <div className="space-y-1.5 text-xs border-b border-dashed border-[#3B2824] pb-3 mb-3">
              <div className="flex justify-between">
                <span className="font-semibold">Order No:</span>
                <span className="font-mono-num font-bold">{selectedOrderForReceipt.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Date:</span>
                <span className="font-mono-num">
                  {new Date(selectedOrderForReceipt.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Guest:</span>
                <span>{selectedOrderForReceipt.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Phone:</span>
                <span className="font-mono-num">{selectedOrderForReceipt.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Fulfilment:</span>
                <span className="uppercase font-bold">{selectedOrderForReceipt.fulfilmentType}</span>
              </div>
              {selectedOrderForReceipt.tableNumber && (
                <div className="flex justify-between">
                  <span className="font-semibold">Dine-In Table:</span>
                  <span className="font-bold">{selectedOrderForReceipt.tableNumber}</span>
                </div>
              )}
              {selectedOrderForReceipt.deliveryAddress && (
                <div>
                  <span className="font-semibold">Address: </span>
                  <span>
                    {selectedOrderForReceipt.deliveryAddress} ({selectedOrderForReceipt.pinCode})
                  </span>
                </div>
              )}
            </div>

            <div className="text-xs border-b border-dashed border-[#3B2824] pb-3 mb-3">
              <p className="font-bold uppercase tracking-wider mb-1.5">Order Items &amp; Variants</p>
              <p className="whitespace-pre-line leading-relaxed">
                {selectedOrderForReceipt.itemsSummary}
              </p>
              {selectedOrderForReceipt.customCakeDetails && (
                <div className="mt-2 p-2 rounded bg-[#FFF8F1] border border-[#E6D7C8]">
                  <p className="font-bold">Custom Cake Specifications:</p>
                  <p className="whitespace-pre-line">{selectedOrderForReceipt.customCakeDetails}</p>
                </div>
              )}
              {selectedOrderForReceipt.specialInstructions && (
                <p className="mt-1.5 italic">
                  Kitchen Note: {selectedOrderForReceipt.specialInstructions}
                </p>
              )}
            </div>

            <div className="space-y-1 text-xs font-mono-num">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{selectedOrderForReceipt.subtotal}</span>
              </div>
              {selectedOrderForReceipt.discountAmount > 0 && (
                <div className="flex justify-between text-[#2D6A4F]">
                  <span>Discount ({selectedOrderForReceipt.couponCode}):</span>
                  <span>-₹{selectedOrderForReceipt.discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Fee:</span>
                <span>₹{selectedOrderForReceipt.deliveryFee}</span>
              </div>
              <div className="flex justify-between">
                <span>Packaging:</span>
                <span>₹{selectedOrderForReceipt.packagingCharge}</span>
              </div>
              <div className="flex justify-between">
                <span>GST / Tax:</span>
                <span>₹{selectedOrderForReceipt.taxAmount}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-[#3B2824] pt-2 mt-2">
                <span>TOTAL:</span>
                <span>₹{selectedOrderForReceipt.totalAmount}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Kitchen Slip
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderForReceipt(null)}
                className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Enterprise BMS Header with Global Search & Notification Center */}
      <div className="bg-[#3B2824] text-[#FFF8F1] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#E5B867]"
            title="Toggle Sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
          <span className="px-2.5 py-1 rounded-lg bg-[#B94E62] text-white text-xs font-bold uppercase tracking-wider">
            BMS Console
          </span>
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold">
              Lovey&apos;s Bakery &amp; Pizza Corners — Enterprise BMS
            </h1>
            <p className="text-[11px] text-[#E5B867]">
              {userEmail} · Role: <strong>{currentRoleDef.name}</strong> · Auto-Lock: {inactivityMinutes}m
            </p>
          </div>
        </div>

        {/* Global Search Bar across Orders, Products, Customers, UTRs */}
        <div className="relative flex-1 max-w-md min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#E5B867] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            placeholder="Global search: Order #, Customer, Product, or 12-digit UTR..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-[#FFF8F1] placeholder:text-[#DECBC0] focus:outline-none focus:border-[#E5B867]"
          />
          {globalSearchResults && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white text-[#3B2824] border border-[#E6D7C8] rounded-2xl shadow-2xl p-3 z-50 space-y-2 text-xs max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E6D7C8] pb-1.5">
                <span className="font-bold text-[10px] uppercase tracking-wider text-[#B94E62]">
                  Instant Global Results
                </span>
                <button
                  type="button"
                  onClick={() => setGlobalSearchQuery('')}
                  className="text-[11px] text-[#6B544E]"
                >
                  Clear
                </button>
              </div>
              {globalSearchResults.orders.map((o) => (
                <div
                  key={o.orderNumber}
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setInspectingOrderDetail(o);
                  }}
                  className="p-2 rounded-xl hover:bg-[#FFF8F1] cursor-pointer flex justify-between"
                >
                  <span className="font-bold font-mono-num">Order #{o.orderNumber}</span>
                  <span>
                    {o.customerName} · ₹{o.totalAmount}
                  </span>
                </div>
              ))}
              {globalSearchResults.products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setGlobalSearchQuery('');
                    onNavigate('/admin/products');
                    setEditingProduct(p);
                  }}
                  className="p-2 rounded-xl hover:bg-[#FFF8F1] cursor-pointer flex justify-between"
                >
                  <span className="font-bold">{p.name}</span>
                  <span className="font-mono-num">
                    ₹{p.basePrice} (Stock: {p.stockQuantity})
                  </span>
                </div>
              ))}
              {globalSearchResults.payments.map((pay) => (
                <div
                  key={pay.orderNumber}
                  onClick={() => {
                    setGlobalSearchQuery('');
                    onNavigate('/admin/payments');
                  }}
                  className="p-2 rounded-xl hover:bg-[#FFF8F1] cursor-pointer flex justify-between"
                >
                  <span className="font-mono-num font-bold">
                    UTR: {pay.latestUtrNumber || 'Pending'}
                  </span>
                  <span>Order #{pay.orderNumber}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Center Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifDrawerOpen(!notifDrawerOpen)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF8F1] relative"
              title="Admin Notifications"
            >
              <Bell className="w-4 h-4" />
              {(unreadNotifsCount > 0 || pendingVerificationCount > 0 || lowStockItemsCount > 0) && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#B94E62] absolute top-1 right-1" />
              )}
            </button>
            {notifDrawerOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white text-[#3B2824] border border-[#E6D7C8] rounded-2xl shadow-2xl p-4 z-50 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-[#E6D7C8] pb-2">
                  <span className="font-bold">Live System Alerts</span>
                  <button
                    type="button"
                    onClick={() => setNotifDrawerOpen(false)}
                    className="text-[11px] text-[#6B544E]"
                  >
                    Close
                  </button>
                </div>
                {pendingVerificationCount > 0 && (
                  <div
                    onClick={() => {
                      setNotifDrawerOpen(false);
                      onNavigate('/admin/payments');
                    }}
                    className="p-2.5 rounded-xl bg-[#FFF4E5] border border-[#B36B00]/30 cursor-pointer"
                  >
                    <p className="font-bold text-[#B36B00]">
                      {pendingVerificationCount} UPI Payment(s) Awaiting Verification
                    </p>
                    <p className="text-[11px] text-[#6B544E]">
                      Click to inspect UTR &amp; payment screenshot
                    </p>
                  </div>
                )}
                {lowStockItemsCount > 0 && (
                  <div
                    onClick={() => {
                      setNotifDrawerOpen(false);
                      onNavigate('/admin/inventory');
                    }}
                    className="p-2.5 rounded-xl bg-[#FFF5F5] border border-[#B94E62]/30 cursor-pointer"
                  >
                    <p className="font-bold text-[#B94E62]">
                      {lowStockItemsCount} Product(s) at Low or Zero Stock
                    </p>
                    <p className="text-[11px] text-[#6B544E]">
                      Click to open Inventory &amp; Restock Ledger
                    </p>
                  </div>
                )}
                {adminNotifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'admin_notifications', n.id), {
                          ...n,
                          isRead: true,
                        });
                      } catch {
                        // ignore
                      }
                      setNotifDrawerOpen(false);
                      if (n.targetRoute) onNavigate(n.targetRoute);
                    }}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] cursor-pointer"
                  >
                    <p className="font-bold">{n.title}</p>
                    <p className="text-[11px] text-[#6B544E]">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            View Live Storefront
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePasswordSignOut}
            className="px-3.5 py-2 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Collapsible Sidebar Navigation */}
        {!sidebarCollapsed && (
          <aside className="lg:col-span-3 xl:col-span-2">
            <nav className="bg-white border border-[#E6D7C8] rounded-2xl p-2.5 flex lg:flex-col gap-1 overflow-x-auto sticky top-20">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  (item.id === 'overview' && (subPath === 'overview' || subPath === '')) ||
                  (item.id === 'settings' && subPath === 'settings') ||
                  (item.id !== 'overview' && item.id !== 'settings' && subPath.startsWith(item.id));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.path)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#3B2824] text-[#FFF8F1]'
                        : 'text-[#3B2824] hover:bg-[#F5EBE1]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Content Pane */}
        <main
          className={`${
            sidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-9 xl:col-span-10'
          } space-y-6`}
        >
          {/* 1. MASTER OVERVIEW TAB */}
          {(subPath === 'overview' || subPath === '') && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E6D7C8] rounded-2xl p-5">
                <div>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#F5EBE1] text-[#B94E62] text-[10px] font-bold uppercase tracking-wider">
                    Master Business Command Center
                  </span>
                  <h2 className="font-serif text-2xl font-bold mt-1">
                    Executive Store Overview &amp; Live Operations
                  </h2>
                  <p className="text-xs text-[#6B544E]">
                    Real-time performance metrics for Lovey&apos;s Bakery &amp; Pizza Corners (Renukoot)
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['all', 'today', '7days', '30days'] as const).map((rng) => (
                    <button
                      key={rng}
                      type="button"
                      onClick={() => setDateRangeFilter(rng)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                        dateRangeFilter === rng
                          ? 'bg-[#3B2824] text-[#FFF8F1]'
                          : 'bg-[#F5EBE1] text-[#3B2824]'
                      }`}
                    >
                      {rng === 'all'
                        ? 'All Time'
                        : rng === 'today'
                        ? 'Today'
                        : rng === '7days'
                        ? 'Last 7 Days'
                        : 'Last 30 Days'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7 One-Click Quick Action Shortcuts */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B544E] mb-2.5">
                  Quick Owner Actions
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/products')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    + Add Product
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/cakes')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    Upload Cake Design
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/inventory')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    Adjust Inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/orders')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    Manage Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/payments')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    Verify UPI Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/website/homepage')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    Edit Homepage CMS
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/media')}
                    className="p-2.5 rounded-xl bg-[#FFF8F1] hover:bg-[#3B2824] hover:text-[#FFF8F1] border border-[#E6D7C8] font-bold text-center transition-colors"
                  >
                    Upload Gallery Photo
                  </button>
                </div>
              </div>

              {/* Real-Time KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider text-[#6B544E] font-semibold">
                    Total Orders
                  </p>
                  <p className="font-serif text-3xl font-bold font-mono-num mt-1">
                    {dateFilteredOrders.length}
                  </p>
                  <p className="text-xs text-[#2D6A4F] mt-1">
                    Active Queue: {pendingOrdersCount} · Cakes: {customCakeOrdersCount}
                  </p>
                </div>
                <div
                  onClick={() => onNavigate('/admin/payments')}
                  className="bg-white border border-[#E6D7C8] rounded-2xl p-5 cursor-pointer hover:border-[#B94E62]"
                >
                  <p className="text-xs uppercase tracking-wider text-[#B36B00] font-semibold">
                    Payments Awaiting Verification
                  </p>
                  <p className="font-serif text-3xl font-bold font-mono-num text-[#B36B00] mt-1">
                    {pendingVerificationCount}
                  </p>
                  <p className="text-xs text-[#6B544E] mt-1">
                    Verified Advance: ₹{verifiedAdvanceTotal.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-wider text-[#2D6A4F] font-semibold">
                    Verified Revenue
                  </p>
                  <p className="font-serif text-3xl font-bold font-mono-num text-[#2D6A4F] mt-1">
                    ₹{totalRevenue.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-[#6B544E] mt-1">
                    Excludes unverified &amp; cancelled orders
                  </p>
                </div>
                <div
                  onClick={() => onNavigate('/admin/inventory')}
                  className="bg-white border border-[#E6D7C8] rounded-2xl p-5 cursor-pointer hover:border-[#B94E62]"
                >
                  <p className="text-xs uppercase tracking-wider text-[#B94E62] font-semibold">
                    Low-Stock / Out-of-Stock SKUs
                  </p>
                  <p className="font-serif text-3xl font-bold font-mono-num text-[#B94E62] mt-1">
                    {lowStockItemsCount}
                  </p>
                  <p className="text-xs text-[#6B544E] mt-1">
                    Out of {products.filter((p) => !p.isArchived).length} active products
                  </p>
                </div>
              </div>

              {/* Recent Orders Quick Table */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-xl font-bold">Recent Customer Orders</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/orders')}
                    className="text-xs font-semibold text-[#B94E62] hover:underline"
                  >
                    Manage All Orders &rarr;
                  </button>
                </div>
                {dateFilteredOrders.length === 0 ? (
                  <p className="text-xs text-[#6B544E] py-6 text-center">
                    No customer orders recorded in this period yet. Place a test order from the storefront to see live order tracking and WhatsApp click-to-chat actions.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                          <th className="py-2.5 pr-4">Order #</th>
                          <th className="py-2.5 pr-4">Guest</th>
                          <th className="py-2.5 pr-4">Fulfilment</th>
                          <th className="py-2.5 pr-4">Total</th>
                          <th className="py-2.5 pr-4">Status</th>
                          <th className="py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6D7C8]">
                        {dateFilteredOrders.slice(0, 8).map((ord) => (
                          <tr key={ord.orderNumber}>
                            <td className="py-3 pr-4 font-mono-num font-bold">
                              {ord.orderNumber}
                            </td>
                            <td className="py-3 pr-4">
                              <p className="font-semibold">{ord.customerName}</p>
                              <p className="text-[#6B544E] font-mono-num">{ord.customerPhone}</p>
                            </td>
                            <td className="py-3 pr-4 uppercase font-semibold">
                              {ord.fulfilmentType}
                              {ord.tableNumber ? ` (${ord.tableNumber})` : ''}
                            </td>
                            <td className="py-3 pr-4 font-mono-num font-bold">
                              ₹{ord.totalAmount}
                            </td>
                            <td className="py-3 pr-4">
                              <select
                                value={ord.orderStatus}
                                onChange={(e) => handleUpdateOrderStatus(ord, e.target.value)}
                                className="px-2.5 py-1 rounded-lg border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
                              >
                                {ORDER_STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {st.replace(/_/g, ' ').toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectingOrderDetail(ord)}
                                className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#FFF8F1] font-semibold"
                              >
                                Inspect
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForReceipt(ord)}
                                className="px-2.5 py-1 rounded-lg bg-[#F5EBE1] text-[#3B2824] font-semibold"
                              >
                                Receipt
                              </button>
                              <a
                                href={buildCustomerWhatsAppUrl(ord)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-[#2D6A4F] text-white font-semibold"
                              >
                                WhatsApp
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ORDERS MANAGEMENT TAB */}
          {subPath.startsWith('orders') && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold">
                    Order Management &amp; Customer Communication
                  </h2>
                  <p className="text-xs text-[#6B544E]">
                    Update order status for live website tracking, print kitchen receipts, inspect full order dossiers, or open a prefilled WhatsApp chat or phone call.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportOrdersCsv}
                  className="px-4 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Orders CSV
                </button>
              </div>

              {/* Separated Order Channel & Custom Cake Tabs */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: `All Orders (${orders.length})` },
                  {
                    id: 'delivery',
                    label: `Home Delivery (${orders.filter((o) => o.fulfilmentType === 'delivery').length})`,
                  },
                  {
                    id: 'pickup',
                    label: `Takeaway / Parcel (${orders.filter((o) => o.fulfilmentType === 'pickup').length})`,
                  },
                  {
                    id: 'dine_in',
                    label: `Dine-In QR (${orders.filter((o) => o.fulfilmentType === 'dine_in').length})`,
                  },
                  {
                    id: 'custom_cake',
                    label: `Custom Cake Orders (${orders.filter((o) => Boolean(o.customCakeDetails)).length})`,
                  },
                  {
                    id: 'quotation',
                    label: `Quotation Requests (${orders.filter((o) => o.orderStatus === 'awaiting_quote').length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrderFulfilmentFilter(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                      orderFulfilmentFilter === tab.id
                        ? 'bg-[#3B2824] text-[#FFF8F1]'
                        : 'bg-white border border-[#E6D7C8] text-[#3B2824] hover:bg-[#F5EBE1]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filter Bar */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6B544E] absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search order #, guest name, or phone..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                  />
                </div>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-medium"
                >
                  <option value="all">All Order Statuses</option>
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Orders List */}
              <div className="space-y-4">
                {orders
                  .filter((o) => {
                    if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter)
                      return false;
                    if (orderFulfilmentFilter === 'delivery' && o.fulfilmentType !== 'delivery')
                      return false;
                    if (orderFulfilmentFilter === 'pickup' && o.fulfilmentType !== 'pickup')
                      return false;
                    if (orderFulfilmentFilter === 'dine_in' && o.fulfilmentType !== 'dine_in')
                      return false;
                    if (orderFulfilmentFilter === 'custom_cake' && !o.customCakeDetails)
                      return false;
                    if (orderFulfilmentFilter === 'quotation' && o.orderStatus !== 'awaiting_quote')
                      return false;
                    if (orderSearch.trim()) {
                      const q = orderSearch.toLowerCase();
                      return (
                        o.orderNumber.toLowerCase().includes(q) ||
                        o.customerName.toLowerCase().includes(q) ||
                        o.customerPhone.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((ord) => (
                    <div
                      key={ord.orderNumber}
                      className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6D7C8] pb-3">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono-num text-base font-bold text-[#3B2824]">
                              {ord.orderNumber}
                            </span>
                            <span className="text-xs text-[#6B544E]">·</span>
                            <span className="text-xs font-bold uppercase text-[#B94E62]">
                              {ord.fulfilmentType.replace('_', ' ')}
                              {ord.tableNumber ? ` · Table ${ord.tableNumber}` : ''}
                            </span>
                            <span className="text-xs text-[#6B544E]">·</span>
                            <span className="text-xs text-[#6B544E] font-mono-num">
                              {new Date(ord.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm font-semibold mt-1">
                            {ord.customerName} ·{' '}
                            <span className="font-mono-num">{ord.customerPhone}</span>
                          </p>
                          {ord.deliveryAddress && (
                            <p className="text-xs text-[#6B544E] mt-0.5">
                              Delivery Address: {ord.deliveryAddress} (PIN: {ord.pinCode})
                            </p>
                          )}
                          {ord.pickupDate && (
                            <p className="text-xs text-[#6B544E] mt-0.5">
                              Requested Date/Slot: {ord.pickupDate} · {ord.pickupTimeSlot}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={ord.orderStatus}
                            onChange={(e) => handleUpdateOrderStatus(ord, e.target.value)}
                            className="px-3 py-2 rounded-xl border border-[#3B2824] bg-[#FFF8F1] text-xs font-bold text-[#3B2824]"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st.replace(/_/g, ' ').toUpperCase()}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setInspectingOrderDetail(ord)}
                            className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-[#3B2824] text-xs font-semibold hover:bg-[#F5EBE1] flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect Order
                          </button>

                          <a
                            href={buildCustomerWhatsAppUrl(ord)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold hover:bg-[#23533D] flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp Customer
                          </a>

                          <a
                            href={`tel:${ord.customerPhone}`}
                            className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-[#3B2824] text-xs font-semibold hover:bg-[#F5EBE1] flex items-center gap-1.5"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </a>

                          <button
                            type="button"
                            onClick={() => setSelectedOrderForReceipt(ord)}
                            className="px-3.5 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Slip
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                        <div className="md:col-span-7 space-y-2">
                          <p className="font-bold uppercase tracking-wider text-[#6B544E]">
                            Items &amp; Selected Variants (Size / Flavor / Frosting)
                          </p>
                          <p className="whitespace-pre-line text-[#3B2824] bg-[#FFF8F1] p-3 rounded-xl border border-[#E6D7C8] leading-relaxed">
                            {ord.itemsSummary}
                          </p>
                          {ord.customCakeDetails && (
                            <div className="p-3 rounded-xl bg-[#F5EBE1] border border-[#E6D7C8]">
                              <p className="font-bold text-[#B94E62] mb-1">
                                Custom Cake Studio Specifications:
                              </p>
                              <p className="whitespace-pre-line">{ord.customCakeDetails}</p>
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-5 bg-[#FFF8F1] p-3.5 rounded-xl border border-[#E6D7C8] flex flex-col justify-between">
                          <div className="space-y-1 font-mono-num">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span>₹{ord.subtotal}</span>
                            </div>
                            {ord.discountAmount > 0 && (
                              <div className="flex justify-between text-[#2D6A4F]">
                                <span>Coupon ({ord.couponCode}):</span>
                                <span>-₹{ord.discountAmount}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>Delivery + Packaging + GST:</span>
                              <span>
                                ₹{ord.deliveryFee + ord.packagingCharge + ord.taxAmount}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm font-bold border-t border-[#E6D7C8] pt-1.5 mt-1.5">
                              <span>Total Payable ({ord.paymentMethod}):</span>
                              <span>₹{ord.totalAmount}</span>
                            </div>
                          </div>

                          {/* Custom Quotation Final Price Updater */}
                          <div className="mt-3 pt-2.5 border-t border-[#E6D7C8] flex items-center gap-2">
                            <input
                              type="number"
                              defaultValue={ord.totalAmount}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (Number.isFinite(val) && val >= 0 && val !== ord.totalAmount) {
                                  handleUpdateOrderStatus(ord, ord.orderStatus, val);
                                }
                              }}
                              className="w-28 px-2.5 py-1.5 rounded-lg border border-[#E6D7C8] bg-white text-xs font-mono-num"
                              title="Update Final Quoted Price (₹)"
                            />
                            <span className="text-[11px] text-[#6B544E]">
                              Adjust Quoted Total (₹)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 3. PRODUCTS & ADVANCED VARIANT LOGIC TAB */}
          {subPath.startsWith('products') && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold">
                    Product Catalogue &amp; Multi-Dimensional Variant Engine
                  </h2>
                  <p className="text-xs text-[#6B544E]">
                    Configure selectable Size/Weight, Flavor, Frosting, and Add-On options with automatic price adjustments (`Label:PriceDelta`).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewProduct(true);
                    setEditingProduct({
                      id: `prod-${Date.now()}`,
                      name: '',
                      nameHi: '',
                      slug: '',
                      categoryId: categories[0]?.id || 'cat-celebration-cakes',
                      categoryName: categories[0]?.name || 'Celebration Cakes',
                      shortDescription: '',
                      fullDescription: '',
                      ingredientsSummary: '',
                      allergenInfo: 'Contains Dairy & Wheat (100% Eggless)',
                      basePrice: 550,
                      compareAtPrice: 650,
                      discountLabel: 'Freshly Baked',
                      taxPercentage: 5,
                      isEggless: true,
                      containsEgg: false,
                      isJainFriendly: false,
                      spiceLevel: 'none',
                      isBestseller: false,
                      isFeatured: true,
                      isNewArrival: true,
                      isAvailable: true,
                      sameDayAvailable: true,
                      advanceNoticeHours: 2,
                      stockQuantity: 20,
                      imageUrl:
                        '/assets/cakes/loveys-chocolate-truffle-gateau.jpg',
                      variantsSummary: '0.5 kg (500g):0 | 1 kg:480 | 1.5 kg:950 | 2 kg:1400',
                      flavorsSummary:
                        'Belgian Dark Truffle:0 | Dutch Hazelnut Praline:120 | Roasted Almond Fudge:90',
                      frostingsSummary:
                        'Silky Dark Ganache:0 | Whipped Cream Rosettes:40 | Chocolate Mirror Glaze:110',
                      addonsSummary:
                        'Sparkler Candle:40 | Birthday Topper:60 | Extra Chocolate Ganache Drip:80',
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add New Product
                </button>
              </div>

              {/* Product Editor Modal / Form */}
              {editingProduct && (
                <form
                  onSubmit={handleSaveProduct}
                  className="bg-white border-2 border-[#3B2824] rounded-2xl p-6 space-y-4 shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-[#E6D7C8] pb-3">
                    <h3 className="font-serif text-xl font-bold">
                      {isNewProduct ? 'Create New Product' : `Edit Product: ${editingProduct.name}`}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="text-xs text-[#6B544E] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Product Name (EN)</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.name}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            name: e.target.value,
                            slug:
                              editingProduct.slug ||
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/(^-|-$)/g, ''),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Product Name (Hindi)</label>
                      <input
                        type="text"
                        value={editingProduct.nameHi}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, nameHi: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Category</label>
                      <select
                        value={editingProduct.categoryId}
                        onChange={(e) => {
                          const cat = categories.find((c) => c.id === e.target.value);
                          setEditingProduct({
                            ...editingProduct,
                            categoryId: e.target.value,
                            categoryName: cat?.name || editingProduct.categoryName,
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Base Price (₹)</label>
                      <input
                        type="number"
                        required
                        value={editingProduct.basePrice}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            basePrice: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Compare-At Price (₹)</label>
                      <input
                        type="number"
                        value={editingProduct.compareAtPrice}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            compareAtPrice: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Image URL</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.imageUrl}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, imageUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Short Description</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.shortDescription}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, shortDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                  </div>

                  {/* MULTI-DIMENSIONAL VARIANT CONFIGURATION */}
                  <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#B94E62]">
                      Multi-Dimensional Variant &amp; Price Delta Matrix (Format: Option Name:PriceDelta | Option 2:PriceDelta)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          1. Size / Weight Options &amp; Price Adjustments (₹)
                        </label>
                        <input
                          type="text"
                          value={editingProduct.variantsSummary}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              variantsSummary: e.target.value,
                            })
                          }
                          placeholder="0.5 kg:0 | 1 kg:450 | 2 kg:1300"
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          2. Selectable Flavor Options &amp; Price Adjustments (₹)
                        </label>
                        <input
                          type="text"
                          value={editingProduct.flavorsSummary || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              flavorsSummary: e.target.value,
                            })
                          }
                          placeholder="Classic Belgian Truffle:0 | Hazelnut Praline:120"
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          3. Selectable Frosting Options &amp; Price Adjustments (₹)
                        </label>
                        <input
                          type="text"
                          value={editingProduct.frostingsSummary || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              frostingsSummary: e.target.value,
                            })
                          }
                          placeholder="Whipped Cream:0 | Dark Ganache:80 | Buttercream:60"
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          4. Optional Add-Ons &amp; Toppers (₹)
                        </label>
                        <input
                          type="text"
                          value={editingProduct.addonsSummary}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              addonsSummary: e.target.value,
                            })
                          }
                          placeholder="Sparkler Candle:40 | Birthday Topper:60"
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5 font-semibold">
                      <input
                        type="checkbox"
                        checked={editingProduct.isEggless}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isEggless: e.target.checked })
                        }
                      />
                      100% Eggless
                    </label>
                    <label className="inline-flex items-center gap-1.5 font-semibold">
                      <input
                        type="checkbox"
                        checked={editingProduct.isBestseller}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isBestseller: e.target.checked })
                        }
                      />
                      Owner-Approved Bestseller
                    </label>
                    <label className="inline-flex items-center gap-1.5 font-semibold">
                      <input
                        type="checkbox"
                        checked={editingProduct.isAvailable}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, isAvailable: e.target.checked })
                        }
                      />
                      Published &amp; In Stock
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold hover:bg-[#B94E62]"
                    >
                      Save Product &amp; Variants
                    </button>
                  </div>
                </form>
              )}

              {/* Products Table */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5EBE1] text-[#3B2824]">
                    <tr>
                      <th className="p-3.5">Product</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Base Price</th>
                      <th className="p-3.5">Configured Variants (Size / Flavor / Frosting)</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D7C8]">
                    {products.map((prod) => (
                      <tr key={prod.id}>
                        <td className="p-3.5 flex items-center gap-3">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-xl object-cover shrink-0"
                          />
                          <div>
                            <p className="font-bold text-[#3B2824]">{prod.name}</p>
                            <p className="text-[11px] text-[#6B544E]">{prod.nameHi}</p>
                          </div>
                        </td>
                        <td className="p-3.5">{prod.categoryName}</td>
                        <td className="p-3.5 font-mono-num font-bold">₹{prod.basePrice}</td>
                        <td className="p-3.5 max-w-xs">
                          <p className="truncate text-[11px]">
                            <strong>Sizes:</strong> {prod.variantsSummary}
                          </p>
                          {prod.flavorsSummary && (
                            <p className="truncate text-[11px] text-[#6B544E]">
                              <strong>Flavors:</strong> {prod.flavorsSummary}
                            </p>
                          )}
                          {prod.frostingsSummary && (
                            <p className="truncate text-[11px] text-[#6B544E]">
                              <strong>Frostings:</strong> {prod.frostingsSummary}
                            </p>
                          )}
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleProductVisibility(prod)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                              prod.isAvailable
                                ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                                : 'bg-[#FFF5F5] text-[#B94E62]'
                            }`}
                          >
                            {prod.isAvailable ? 'Published' : 'Hidden'}
                          </button>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsNewProduct(false);
                                setEditingProduct(prod);
                              }}
                              className="p-1.5 rounded-lg bg-[#F5EBE1] text-[#3B2824]"
                              title="Edit Product & Variants"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 rounded-lg bg-[#FFF5F5] text-[#B94E62]"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. CATEGORIES TAB */}
          {subPath.startsWith('categories') && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold">Categories Management</h2>
                  <p className="text-xs text-[#6B544E]">
                    Organize bakery, cake, pastry, and pizza departments
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingCategory({
                      id: `cat-${Date.now()}`,
                      name: '',
                      nameHi: '',
                      slug: '',
                      description: '',
                      imageUrl: '/assets/bakery/loveys-pastries-cookies.jpg',
                      displayOrder: categories.length + 1,
                      isActive: true,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>

              {editingCategory && (
                <form
                  onSubmit={handleSaveCategory}
                  className="bg-white border-2 border-[#3B2824] rounded-2xl p-5 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Category Name (EN)"
                      value={editingCategory.name}
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          name: e.target.value,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                        })
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Category Name (Hindi)"
                      value={editingCategory.nameHi}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, nameHi: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={editingCategory.description}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, description: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="px-3 py-1.5 rounded-xl border border-[#E6D7C8] text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                    >
                      Save Category
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-white border border-[#E6D7C8] rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div>
                        <p className="font-bold text-sm">{cat.name}</p>
                        <p className="text-xs text-[#6B544E]">{cat.nameHi}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingCategory(cat)}
                      className="p-2 rounded-xl bg-[#F5EBE1] text-xs font-semibold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. CUSTOM CAKES CATALOGUE TAB */}
          {subPath.startsWith('cakes') && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold">Custom Cake Designs Studio</h2>
                  <p className="text-xs text-[#6B544E]">
                    Manage signature custom cake templates, minimum weights, and quotation flags
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingCakeDesign({
                      id: `cake-design-${Date.now()}`,
                      title: '',
                      occasion: 'Birthday',
                      description: '',
                      imageUrl: '/assets/cakes/loveys-tier-celebration-cake.jpg',
                      startingPrice: 1250,
                      minWeightKg: 1,
                      maxWeightKg: 5,
                      availableFlavours: 'Belgian Chocolate Truffle, Red Velvet, Rasmalai',
                      leadTimeHours: 24,
                      isQuotationBased: false,
                      isActive: true,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Cake Design
                </button>
              </div>

              {editingCakeDesign && (
                <form
                  onSubmit={handleSaveCakeDesign}
                  className="bg-white border-2 border-[#3B2824] rounded-2xl p-5 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Design Title"
                      value={editingCakeDesign.title}
                      onChange={(e) =>
                        setEditingCakeDesign({ ...editingCakeDesign, title: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Occasion (e.g. Anniversary, Kids)"
                      value={editingCakeDesign.occasion}
                      onChange={(e) =>
                        setEditingCakeDesign({ ...editingCakeDesign, occasion: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Starting Price (₹)"
                      value={editingCakeDesign.startingPrice}
                      onChange={(e) =>
                        setEditingCakeDesign({
                          ...editingCakeDesign,
                          startingPrice: Number(e.target.value),
                        })
                      }
                      className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description"
                    value={editingCakeDesign.description}
                    onChange={(e) =>
                      setEditingCakeDesign({ ...editingCakeDesign, description: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCakeDesign(null)}
                      className="px-3 py-1.5 rounded-xl border border-[#E6D7C8] text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                    >
                      Save Design
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cakeDesigns.map((cd) => (
                  <div
                    key={cd.id}
                    className="bg-white border border-[#E6D7C8] rounded-2xl p-4 flex gap-4"
                  >
                    <img
                      src={cd.imageUrl}
                      alt={cd.title}
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 rounded-xl object-cover shrink-0"
                    />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold uppercase text-[#B94E62]">
                        {cd.occasion} · Min {cd.minWeightKg} kg
                      </p>
                      <h4 className="font-serif text-lg font-bold">{cd.title}</h4>
                      <p className="text-xs text-[#6B544E] line-clamp-2 mt-0.5">
                        {cd.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-mono-num text-xs font-bold">
                          Starts at ₹{cd.startingPrice}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingCakeDesign(cd)}
                          className="text-xs font-semibold text-[#B94E62] hover:underline"
                        >
                          Edit Design
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. DYNAMIC GALLERY & CLOUD MEDIA LIBRARY TAB */}
          {subPath.startsWith('media') && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold">
                    Dynamic Gallery &amp; Cloud Storage Media Library
                  </h2>
                  <p className="text-xs text-[#6B544E]">
                    Upload original Lovey&apos;s photographs via Cloud Storage or add an owner-authorised image or video URL to dynamically update the public Gallery and Hero sections.
                  </p>
                </div>

                <form onSubmit={handleCreateMediaAsset} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Media Title / Caption</label>
                      <input
                        type="text"
                        required
                        value={mediaTitle}
                        onChange={(e) => setMediaTitle(e.target.value)}
                        placeholder="e.g. Golden Anniversary 3-Tier Truffle Cake"
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Media Type</label>
                      <select
                        value={mediaType}
                        onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      >
                        <option value="image">Original Photograph</option>
                        <option value="video">Authorised Bakery Video</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Target Section</label>
                      <select
                        value={mediaSection}
                        onChange={(e) => setMediaSection(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      >
                        <option value="gallery">Public Bakery Gallery (/gallery)</option>
                        <option value="custom_cakes">Custom Cake Showcase</option>
                        <option value="hero">Homepage Hero Banner</option>
                        <option value="products">Product Highlights</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Display Aspect Ratio</label>
                      <select
                        value={mediaAspectRatio}
                        onChange={(e) => setMediaAspectRatio(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      >
                        <option value="4:3">4:3 Standard Editorial</option>
                        <option value="1:1">1:1 Square Showcase</option>
                        <option value="16:9">16:9 Wide Banner</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                      <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#B94E62]" />
                        Upload Original Image File to Cloud Storage
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleMediaFileSelect}
                        className="block w-full text-xs text-[#6B544E] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#3B2824] file:text-[#FFF8F1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Or Direct Media URL (Image or MP4 Video path)
                      </label>
                      <input
                        type="text"
                        value={mediaImageUrl}
                        onChange={(e) => setMediaImageUrl(e.target.value)}
                        placeholder="/assets/gallery/... or Cloud Storage URL"
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                      />
                    </div>
                  </div>

                  {mediaStatusMsg && (
                    <p className="text-xs text-[#2D6A4F] font-semibold">{mediaStatusMsg}</p>
                  )}

                  <button
                    type="submit"
                    disabled={mediaUploading || !mediaTitle || !mediaImageUrl}
                    className="px-5 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold hover:bg-[#9E3D50] disabled:opacity-50"
                  >
                    {mediaUploading ? 'Uploading...' : 'Publish Media to Live Gallery'}
                  </button>
                </form>
              </div>

              {/* Existing Gallery & Media Assets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaAssets.map((asset) => {
                  const srcUrl = asset.imageUrl || asset.url || '';
                  const isVideo = asset.mediaType === 'video' || /\.(mp4|webm|ogg)$/i.test(srcUrl);
                  return (
                    <div
                      key={asset.id}
                      className="bg-white border border-[#E6D7C8] rounded-2xl overflow-hidden flex flex-col justify-between"
                    >
                      {isVideo ? (
                        <div className="w-full h-44 bg-[#1E1412] flex items-center justify-center relative">
                          <video
                            src={srcUrl}
                            preload="metadata"
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold flex items-center gap-1">
                            <Video className="w-3 h-3" /> Video
                          </span>
                        </div>
                      ) : (
                        <img
                          src={srcUrl}
                          alt={asset.altText}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-cover"
                        />
                      )}
                      <div className="p-4 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                            {asset.section || asset.category || 'gallery'} · {asset.aspectRatio}
                          </span>
                          <p className="font-bold text-xs text-[#3B2824] mt-0.5">{asset.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'media_assets', asset.id));
                            } catch (err) {
                              handleFirestoreError(
                                err,
                                OperationType.DELETE,
                                `media_assets/${asset.id}`
                              );
                            }
                          }}
                          className="p-2 rounded-lg bg-[#FFF5F5] text-[#B94E62]"
                          title="Remove Media"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 7. CUSTOMERS TAB */}
          {subPath.startsWith('customers') && (
            <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4">
              <h2 className="font-serif text-2xl font-bold">Customer Directory &amp; Order History</h2>
              {customerList.length === 0 ? (
                <p className="text-xs text-[#6B544E]">No customer records yet.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <tr>
                      <th className="py-2.5">Customer Name</th>
                      <th className="py-2.5">Phone</th>
                      <th className="py-2.5">Total Orders</th>
                      <th className="py-2.5">Total Spent</th>
                      <th className="py-2.5">Latest Order #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D7C8]">
                    {customerList.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-bold">{c.name}</td>
                        <td className="py-3 font-mono-num">{c.phone}</td>
                        <td className="py-3 font-mono-num">{c.totalOrders}</td>
                        <td className="py-3 font-mono-num font-bold">₹{c.totalSpent}</td>
                        <td className="py-3 font-mono-num">{c.lastOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 8. PROMOTIONS / COUPONS TAB */}
          {subPath.startsWith('promotions') && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateCoupon}
                className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4"
              >
                <h2 className="font-serif text-2xl font-bold">Create Promotional Coupon</h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="CODE (e.g. FESTIVE15)"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs uppercase font-mono-num"
                  />
                  <select
                    value={newCouponType}
                    onChange={(e) => setNewCouponType(e.target.value as any)}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="flat">Flat Rupee Discount (₹)</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Discount Value"
                    value={newCouponValue}
                    onChange={(e) => setNewCouponValue(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                  />
                  <input
                    type="number"
                    placeholder="Min Cart Value (₹)"
                    value={newCouponMinCart}
                    onChange={(e) => setNewCouponMinCart(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                >
                  Save Coupon Code
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {coupons.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white border border-[#E6D7C8] rounded-2xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono-num font-bold text-base text-[#B94E62]">{c.code}</p>
                      <p className="text-xs text-[#6B544E]">
                        {c.discountType === 'percentage'
                          ? `${c.discountValue}% OFF`
                          : `₹${c.discountValue} FLAT OFF`}{' '}
                        · Min ₹{c.minCartValue}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await setDoc(doc(db, 'coupons', c.id), {
                          ...c,
                          isActive: !c.isActive,
                        });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        c.isActive
                          ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                          : 'bg-[#FFF5F5] text-[#B94E62]'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. TABLES & DINE-IN QR ORDERING TAB */}
          {subPath.startsWith('tables') && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
                <h2 className="font-serif text-2xl font-bold">
                  Dine-In Tables &amp; Printable QR Ordering Cards
                </h2>
                <p className="text-xs text-[#6B544E]">
                  Customers scanning a table QR code automatically open the menu with their table pre-selected for Dine-In service.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {diningTables.map((tbl) => {
                  const qrTargetUrl = `${window.location.origin}/?table=${encodeURIComponent(
                    tbl.tableNumber
                  )}`;
                  return (
                    <div
                      key={tbl.id}
                      className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#B94E62]">
                            Table {tbl.tableNumber} · {tbl.capacity} Seats
                          </span>
                          <h3 className="font-serif text-lg font-bold mt-0.5">{tbl.label}</h3>
                        </div>
                        <QrCode className="w-8 h-8 text-[#3B2824]" />
                      </div>

                      <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] text-[11px] font-mono-num break-all">
                        {qrTargetUrl}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/?table=${tbl.tableNumber}`)}
                          className="flex-1 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                        >
                          Test Table QR Flow
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 10. REPORTS TAB */}
          {subPath.startsWith('reports') && (
            <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold">Sales &amp; Fulfilment Reports</h2>
                  <p className="text-xs text-[#6B544E]">
                    Breakdown by fulfilment channel and payment status
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportOrdersCsv}
                  className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Full CSV Report
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['delivery', 'pickup', 'dine_in'] as const).map((mode) => {
                  const subset = orders.filter((o) => o.fulfilmentType === mode);
                  const rev = subset.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
                  return (
                    <div
                      key={mode}
                      className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]"
                    >
                      <p className="text-xs font-bold uppercase text-[#B94E62]">
                        {mode.replace('_', ' ')} Channel
                      </p>
                      <p className="font-serif text-2xl font-bold font-mono-num mt-1">
                        {subset.length} Orders
                      </p>
                      <p className="text-xs text-[#2D6A4F] font-mono-num font-semibold mt-0.5">
                        Revenue: ₹{rev.toLocaleString('en-IN')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 11. OWNER MANUAL UPI PAYMENT VERIFICATION DASHBOARD (/admin/payments) */}
          {subPath.startsWith('payments') && (
            <div className="space-y-6">
              {/* Screenshot Full Inspection Modal */}
              {inspectingScreenshotOrder && (
                <div
                  onClick={() => setInspectingScreenshotOrder(null)}
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white border border-[#E6D7C8] rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl"
                  >
                    <div className="bg-[#3B2824] text-[#FFF8F1] px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-widest text-[#E5B867] font-bold">
                          Customer Payment Proof Inspection
                        </p>
                        <h3 className="font-serif text-xl font-bold">
                          Order #{inspectingScreenshotOrder.orderNumber} · UTR:{' '}
                          <span className="font-mono-num">
                            {inspectingScreenshotOrder.latestUtrNumber || 'N/A'}
                          </span>
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingScreenshotOrder(null)}
                        className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-semibold"
                      >
                        Close
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-xs bg-[#FFF8F1] p-3.5 rounded-2xl border border-[#E6D7C8]">
                        <div>
                          <span className="text-[#6B544E] block">Customer</span>
                          <span className="font-bold">
                            {inspectingScreenshotOrder.customerName} (
                            {inspectingScreenshotOrder.customerPhone})
                          </span>
                        </div>
                        <div>
                          <span className="text-[#6B544E] block">Required Advance</span>
                          <span className="font-mono-num font-bold text-[#B94E62]">
                            ₹{inspectingScreenshotOrder.requiredAdvanceAmount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#6B544E] block">Submitted Amount</span>
                          <span className="font-mono-num font-bold text-[#2D6A4F]">
                            ₹{inspectingScreenshotOrder.submittedAmount}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#1E1412] rounded-2xl p-3 flex items-center justify-center max-h-[60vh] overflow-auto">
                        {inspectingScreenshotOrder.latestScreenshotUrl ? (
                          <img
                            src={inspectingScreenshotOrder.latestScreenshotUrl}
                            alt={`Payment Screenshot for ${inspectingScreenshotOrder.orderNumber}`}
                            className="max-h-[55vh] w-auto object-contain rounded-xl"
                          />
                        ) : (
                          <p className="text-xs text-[#DECBC0] py-12">
                            No payment screenshot uploaded yet.
                          </p>
                        )}
                      </div>

                      {inspectingScreenshotOrder.paymentStatus !== 'VERIFIED' && (
                        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const rec = inspectingScreenshotOrder;
                              setInspectingScreenshotOrder(null);
                              handleVerifyAdvancePayment(rec);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#23533D] text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Verify Advance &amp; Confirm Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const rec = inspectingScreenshotOrder;
                              setInspectingScreenshotOrder(null);
                              setRejectionReasonInput('');
                              setRejectModalOrder({ record: rec, mode: 'REJECTED' });
                            }}
                            className="px-4 py-2.5 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs font-bold"
                          >
                            Reject Payment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Reject / Request Resubmission Reason Modal */}
              {rejectModalOrder && (
                <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
                  <form
                    onSubmit={handleConfirmRejectOrResubmit}
                    className="bg-white border-2 border-[#B94E62] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#B94E62]">
                        {rejectModalOrder.mode === 'REJECTED'
                          ? 'Reject Advance Payment Submission'
                          : 'Request New Payment Screenshot'}
                      </span>
                      <h3 className="font-serif text-2xl font-bold text-[#3B2824] mt-0.5">
                        Order #{rejectModalOrder.record.orderNumber} ·{' '}
                        {rejectModalOrder.record.customerName}
                      </h3>
                      <p className="text-xs text-[#6B544E] mt-1">
                        The order will remain unconfirmed and the customer will see your reason on their live order tracking page with an option to upload a new screenshot and UTR.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#3B2824] mb-1">
                        Reason / Instruction for Customer (Required) *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder={
                          rejectModalOrder.mode === 'REJECTED'
                            ? 'e.g. UTR 432618904512 could not be matched in our bank statement, or amount paid is lower than required advance.'
                            : 'e.g. The uploaded image is blurry / cropped and does not show the 12-digit UPI UTR number clearly. Please upload the full screenshot.'
                        }
                        className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRejectModalOrder(null)}
                        className="px-4 py-2 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs font-bold"
                      >
                        {rejectModalOrder.mode === 'REJECTED'
                          ? 'Confirm Rejection'
                          : 'Send Screenshot Request'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Header */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#B94E62]">
                    Manual UPI Advance Payment Verification Center
                  </span>
                  <h2 className="font-serif text-2xl font-bold">
                    Verify Customer Advance Payments &amp; UTR Submissions
                  </h2>
                  <p className="text-xs text-[#6B544E]">
                    Inspect uploaded UPI payment screenshots and 12-digit UTR numbers before confirming Home Delivery and Takeaway/Parcel orders.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin/settings/payments')}
                  className="px-4 py-2.5 rounded-xl bg-[#3B2824] hover:bg-[#B94E62] text-[#FFF8F1] text-xs font-semibold flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#E5B867]" />
                  <span>Configure UPI ID, QR &amp; Advance Rules</span>
                </button>
              </div>

              {paymentActionBanner && (
                <div className="p-3.5 rounded-2xl bg-[#E8F5E9] border border-[#2D6A4F] text-[#2D6A4F] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{paymentActionBanner}</span>
                </div>
              )}

              {/* 6 Filter Tabs + Search */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'all', label: 'All Payments', count: orderPayments.length },
                    {
                      id: 'awaiting',
                      label: 'Awaiting Payment',
                      count: orderPayments.filter(
                        (p) =>
                          p.paymentStatus === 'AWAITING_PAYMENT' ||
                          p.paymentStatus === 'CONTACT_PENDING'
                      ).length,
                    },
                    {
                      id: 'submitted',
                      label: 'Submitted for Verification',
                      count: orderPayments.filter((p) => p.paymentStatus === 'PAYMENT_SUBMITTED')
                        .length,
                    },
                    {
                      id: 'verified',
                      label: 'Verified',
                      count: orderPayments.filter((p) => p.paymentStatus === 'VERIFIED').length,
                    },
                    {
                      id: 'rejected',
                      label: 'Rejected / Resubmit',
                      count: orderPayments.filter(
                        (p) =>
                          p.paymentStatus === 'REJECTED' ||
                          p.paymentStatus === 'RESUBMISSION_REQUESTED'
                      ).length,
                    },
                    {
                      id: 'expired',
                      label: 'Expired',
                      count: orderPayments.filter((p) => p.paymentStatus === 'EXPIRED').length,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPaymentTabFilter(tab.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        paymentTabFilter === tab.id
                          ? 'bg-[#3B2824] text-[#FFF8F1]'
                          : 'bg-[#FFF8F1] text-[#3B2824] border border-[#E6D7C8] hover:bg-[#F5EBE1]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="px-1.5 py-0.5 rounded bg-black/15 font-mono-num text-[10px]">
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-[#6B544E] absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={paymentSearchQuery}
                    onChange={(e) => setPaymentSearchQuery(e.target.value)}
                    placeholder="Search by Order #, Customer Name, Phone, or 12-digit UPI UTR..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                  />
                </div>
              </div>

              {/* Payment Records List */}
              <div className="space-y-4">
                {orderPayments
                  .filter((rec) => {
                    if (paymentTabFilter === 'awaiting') {
                      if (
                        rec.paymentStatus !== 'AWAITING_PAYMENT' &&
                        rec.paymentStatus !== 'CONTACT_PENDING'
                      )
                        return false;
                    } else if (paymentTabFilter === 'submitted') {
                      if (rec.paymentStatus !== 'PAYMENT_SUBMITTED') return false;
                    } else if (paymentTabFilter === 'verified') {
                      if (rec.paymentStatus !== 'VERIFIED') return false;
                    } else if (paymentTabFilter === 'rejected') {
                      if (
                        rec.paymentStatus !== 'REJECTED' &&
                        rec.paymentStatus !== 'RESUBMISSION_REQUESTED'
                      )
                        return false;
                    } else if (paymentTabFilter === 'expired') {
                      if (rec.paymentStatus !== 'EXPIRED') return false;
                    }

                    if (paymentSearchQuery.trim()) {
                      const q = paymentSearchQuery.toLowerCase();
                      return (
                        rec.orderNumber.toLowerCase().includes(q) ||
                        rec.customerName.toLowerCase().includes(q) ||
                        rec.customerPhone.toLowerCase().includes(q) ||
                        (rec.latestUtrNumber || '').toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((rec) => {
                    const orderHistory = paymentHistory.filter(
                      (h) => h.orderNumber === rec.orderNumber
                    );
                    return (
                      <div
                        key={rec.orderNumber}
                        className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6D7C8] pb-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono-num text-base font-bold text-[#3B2824]">
                                {rec.orderNumber}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-lg bg-[#FFF8F1] border border-[#E6D7C8] text-[11px] font-bold uppercase text-[#B94E62]">
                                {rec.fulfilmentType === 'delivery'
                                  ? 'Home Delivery'
                                  : rec.fulfilmentType === 'pickup'
                                  ? 'Takeaway / Parcel'
                                  : 'Dine-In'}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase ${
                                  rec.paymentStatus === 'VERIFIED'
                                    ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                                    : rec.paymentStatus === 'PAYMENT_SUBMITTED'
                                    ? 'bg-amber-100 text-amber-900'
                                    : rec.paymentStatus === 'REJECTED' ||
                                      rec.paymentStatus === 'RESUBMISSION_REQUESTED'
                                    ? 'bg-[#FFF5F5] text-[#B94E62]'
                                    : 'bg-[#F5EBE1] text-[#3B2824]'
                                }`}
                              >
                                {rec.paymentStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm font-bold mt-1">
                              {rec.customerName} ·{' '}
                              <span className="font-mono-num">{rec.customerPhone}</span>
                            </p>
                            <p className="text-[11px] text-[#6B544E] font-mono-num">
                              Created: {new Date(rec.createdAt).toLocaleString()}
                              {rec.latestSubmittedAt
                                ? ` · Proof Submitted: ${new Date(
                                    rec.latestSubmittedAt
                                  ).toLocaleString()}`
                                : ''}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {rec.paymentStatus !== 'VERIFIED' && (
                              <button
                                type="button"
                                onClick={() => handleVerifyAdvancePayment(rec)}
                                className="px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#23533D] text-white text-xs font-bold flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verify Payment</span>
                              </button>
                            )}
                            {rec.paymentStatus !== 'VERIFIED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectionReasonInput(rec.rejectionReason || '');
                                  setRejectModalOrder({ record: rec, mode: 'REJECTED' });
                                }}
                                className="px-3.5 py-2 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs font-bold flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject Payment</span>
                              </button>
                            )}
                            {rec.paymentStatus !== 'VERIFIED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectionReasonInput('');
                                  setRejectModalOrder({
                                    record: rec,
                                    mode: 'RESUBMISSION_REQUESTED',
                                  });
                                }}
                                className="px-3.5 py-2 rounded-xl border border-[#3B2824] hover:bg-[#F5EBE1] text-[#3B2824] text-xs font-bold flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Request New Screenshot</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Financial & UTR Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                              <span className="text-[#6B544E] block">Total Amount</span>
                              <span className="font-mono-num font-bold text-sm">
                                ₹{rec.totalOrderAmount}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                              <span className="text-[#6B544E] block">Required Advance</span>
                              <span className="font-mono-num font-bold text-sm text-[#B94E62]">
                                ₹{rec.requiredAdvanceAmount}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                              <span className="text-[#6B544E] block">Submitted / Verified</span>
                              <span className="font-mono-num font-bold text-sm text-[#2D6A4F]">
                                ₹{rec.verifiedAdvanceAmount || rec.submittedAmount || 0}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8]">
                              <span className="text-[#6B544E] block">Remaining Balance</span>
                              <span className="font-mono-num font-bold text-sm">
                                ₹{rec.remainingBalanceAmount}
                              </span>
                            </div>
                            <div className="col-span-2 sm:col-span-4 p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="text-[#6B544E] mr-2">
                                  Submitted UPI Reference / UTR:
                                </span>
                                <span className="font-mono-num font-bold text-sm text-[#3B2824]">
                                  {rec.latestUtrNumber || 'Not submitted yet'}
                                </span>
                              </div>
                              {rec.verifiedByEmail && (
                                <span className="text-[11px] text-[#2D6A4F] font-semibold">
                                  Verified by {rec.verifiedByEmail}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Screenshot Thumbnail & Inspect Button */}
                          <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
                            {rec.latestScreenshotUrl ? (
                              <div className="text-center space-y-2">
                                <img
                                  src={rec.latestScreenshotUrl}
                                  alt={`Screenshot ${rec.orderNumber}`}
                                  onClick={() => setInspectingScreenshotOrder(rec)}
                                  className="h-28 w-auto object-contain mx-auto rounded-lg border border-[#E6D7C8] cursor-pointer hover:opacity-90"
                                />
                                <button
                                  type="button"
                                  onClick={() => setInspectingScreenshotOrder(rec)}
                                  className="px-3 py-1.5 rounded-lg bg-[#3B2824] text-[#FFF8F1] text-[11px] font-semibold flex items-center gap-1 mx-auto"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect Full Screenshot</span>
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-[#6B544E] py-6 text-center">
                                No payment screenshot uploaded yet
                              </p>
                            )}
                          </div>
                        </div>

                        {rec.rejectionReason && (
                          <div className="p-3 rounded-xl bg-[#FFF5F5] border border-[#B94E62] text-xs text-[#B94E62]">
                            <strong>Rejection / Resubmission Reason Sent to Customer:</strong>{' '}
                            {rec.rejectionReason}
                          </div>
                        )}

                        {/* Internal Admin Note Input */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E6D7C8]">
                          <input
                            type="text"
                            value={
                              internalNoteInputs[rec.orderNumber] ?? rec.internalAdminNote ?? ''
                            }
                            onChange={(e) =>
                              setInternalNoteInputs((prev) => ({
                                ...prev,
                                [rec.orderNumber]: e.target.value,
                              }))
                            }
                            placeholder="Add internal verification note (e.g. Checked PNB merchant app at 5:15 PM)..."
                            className="flex-1 px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveInternalPaymentNote(rec)}
                            className="px-4 py-2 rounded-xl bg-[#F5EBE1] hover:bg-[#E6D7C8] text-[#3B2824] text-xs font-semibold"
                          >
                            Save Internal Note
                          </button>
                        </div>

                        {/* Collapsible Audit History */}
                        {orderHistory.length > 0 && (
                          <div className="pt-2 space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B544E]">
                              Verification History ({orderHistory.length})
                            </p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {orderHistory.map((h) => (
                                <div
                                  key={h.id}
                                  className="text-[11px] text-[#6B544E] flex flex-wrap justify-between gap-2 bg-[#FFF8F1] px-2.5 py-1.5 rounded-lg"
                                >
                                  <span>
                                    <strong className="text-[#3B2824]">{h.action}</strong>:{' '}
                                    {h.note}
                                  </span>
                                  <span className="font-mono-num">
                                    {new Date(h.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {orderPayments.length === 0 && (
                  <div className="bg-white border border-[#E6D7C8] rounded-2xl p-8 text-center text-xs text-[#6B544E]">
                    No advance payment records yet. When customers place a Home Delivery or Takeaway/Parcel order, their advance payment record and uploaded UPI screenshot/UTR will appear here for one-click verification.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 12. OWNER-CONTROLLED ADVANCE PAYMENT SETTINGS (/admin/settings/payments) */}
          {subPath === 'settings/payments' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSavePaymentSettings}
                className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D7C8] pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#B94E62]">
                      Owner Configuration · /admin/settings/payments
                    </span>
                    <h2 className="font-serif text-2xl font-bold">
                      Manual UPI Advance Payment &amp; QR Settings
                    </h2>
                    <p className="text-xs text-[#6B544E]">
                      Configure your official UPI ID, Payee Name, actual uploaded payment QR image, and server-side advance payment rules for Home Delivery and Takeaway/Parcel orders.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={qrUploading}
                    className="px-5 py-2.5 rounded-xl bg-[#B94E62] hover:bg-[#9E3D50] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Advance Payment Settings</span>
                  </button>
                </div>

                {paymentSettingsSavedMsg && (
                  <div className="p-3.5 rounded-xl bg-[#E8F5E9] border border-[#2D6A4F] text-[#2D6A4F] text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{paymentSettingsSavedMsg}</span>
                  </div>
                )}

                {paymentSettingsErrorMsg && (
                  <div className="p-3.5 rounded-xl bg-[#FFF5F5] border border-[#B94E62] text-[#B94E62] text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{paymentSettingsErrorMsg}</span>
                  </div>
                )}

                {/* Section 1: UPI ID, Payee Name & Actual Owner QR Image Upload */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8]">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="font-serif text-lg font-bold text-[#3B2824]">
                      1. Official Merchant UPI Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          Merchant UPI ID (VPA) *
                        </label>
                        <input
                          type="text"
                          required
                          value={localPaymentSettings.upiId}
                          onChange={(e) =>
                            setLocalPaymentSettings({
                              ...localPaymentSettings,
                              upiId: e.target.value,
                            })
                          }
                          placeholder="e.g. loveysbakery@pnb"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-mono-num font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">
                          UPI Account / Payee Display Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={localPaymentSettings.payeeDisplayName}
                          onChange={(e) =>
                            setLocalPaymentSettings({
                              ...localPaymentSettings,
                              payeeDisplayName: e.target.value,
                            })
                          }
                          placeholder="Lovey's Bakery & Pizza Corners"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-white text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">
                        Upload Actual Payment QR Image (JPG, PNG, WebP) *
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleQrImageFileSelect}
                        className="block w-full text-xs text-[#6B544E] file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#3B2824] file:text-[#FFF8F1]"
                      />
                      <p className="text-[11px] text-[#6B544E] mt-1">
                        Always upload your genuine bank/UPI merchant QR code image. The system never generates a fake QR code.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">
                        Or Paste Uploaded Cloud Storage QR Image URL
                      </label>
                      <input
                        type="text"
                        value={localPaymentSettings.qrCodeImageUrl}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            qrCodeImageUrl: e.target.value,
                          })
                        }
                        placeholder="https://... or uploaded data URL"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Live QR Preview */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-[#E6D7C8] text-center space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#B94E62]">
                      Active Owner UPI QR Preview
                    </span>
                    {localPaymentSettings.qrCodeImageUrl ? (
                      <>
                        <img
                          src={localPaymentSettings.qrCodeImageUrl}
                          alt="Owner Uploaded UPI QR Code"
                          className="w-44 h-44 object-contain rounded-xl border border-[#E6D7C8] p-2"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setLocalPaymentSettings({
                              ...localPaymentSettings,
                              qrCodeImageUrl: '',
                            })
                          }
                          className="text-[11px] text-[#B94E62] font-semibold hover:underline"
                        >
                          Remove QR Image
                        </button>
                      </>
                    ) : (
                      <div className="py-10 px-4 text-xs text-[#6B544E]">
                        No QR image uploaded yet. Upload your official bank/UPI QR image on the left to enable mandatory QR checkout.
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Fulfilment Toggles (Home Delivery vs Takeaway/Parcel) */}
                <div className="p-5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-4">
                  <h3 className="font-serif text-lg font-bold text-[#3B2824]">
                    2. Eligible Order Types &amp; Mandatory Advance Toggles
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <label className="p-3.5 rounded-xl bg-white border border-[#E6D7C8] flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localPaymentSettings.mandatoryForDelivery}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            mandatoryForDelivery: e.target.checked,
                          })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-[#3B2824]">
                          Mandatory for Home Delivery
                        </span>
                        <span className="text-[11px] text-[#6B544E]">
                          Requires advance payment before confirming delivery orders.
                        </span>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-xl bg-white border border-[#E6D7C8] flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localPaymentSettings.mandatoryForPickup}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            mandatoryForPickup: e.target.checked,
                          })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-[#3B2824]">
                          Mandatory for Takeaway / Parcel
                        </span>
                        <span className="text-[11px] text-[#6B544E]">
                          Requires advance payment before confirming store pickup orders.
                        </span>
                      </div>
                    </label>

                    <label className="p-3.5 rounded-xl bg-white border border-[#E6D7C8] flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localPaymentSettings.useSeparateRulesByOrderType}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            useSeparateRulesByOrderType: e.target.checked,
                          })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold block text-[#3B2824]">
                          Use Different Rules by Order Type
                        </span>
                        <span className="text-[11px] text-[#6B544E]">
                          Configure separate % or fixed advance for Takeaway/Parcel.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Section 3: Server-Side Advance Calculation Rules */}
                <div className="p-5 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-4">
                  <h3 className="font-serif text-lg font-bold text-[#3B2824]">
                    3. Advance Payment Calculation Rules (Server-Enforced)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <label className="block font-bold mb-1">Advance Type</label>
                      <select
                        value={localPaymentSettings.advanceType}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            advanceType: e.target.value as 'percentage' | 'fixed',
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (₹)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Advance Percentage (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={localPaymentSettings.advancePercentage}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            advancePercentage: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Fixed Advance (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={localPaymentSettings.fixedAdvanceAmount}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            fixedAdvanceAmount: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Min Advance (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={localPaymentSettings.minAdvanceAmount}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            minAdvanceAmount: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Max Advance Cap (₹)</label>
                      <input
                        type="number"
                        min={100}
                        value={localPaymentSettings.maxAdvanceAmount}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            maxAdvanceAmount: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">Payment Window (Mins)</label>
                      <input
                        type="number"
                        min={5}
                        max={1440}
                        value={localPaymentSettings.paymentDeadlineMinutes}
                        onChange={(e) =>
                          setLocalPaymentSettings({
                            ...localPaymentSettings,
                            paymentDeadlineMinutes: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                      />
                    </div>
                  </div>

                  {localPaymentSettings.useSeparateRulesByOrderType && (
                    <div className="pt-3 border-t border-[#E6D7C8] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-bold mb-1">
                          Takeaway / Parcel Advance Type
                        </label>
                        <select
                          value={localPaymentSettings.pickupAdvanceType}
                          onChange={(e) =>
                            setLocalPaymentSettings({
                              ...localPaymentSettings,
                              pickupAdvanceType: e.target.value as 'percentage' | 'fixed',
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold mb-1">
                          Takeaway Advance Percentage (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={localPaymentSettings.pickupAdvancePercentage}
                          onChange={(e) =>
                            setLocalPaymentSettings({
                              ...localPaymentSettings,
                              pickupAdvancePercentage: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">
                          Takeaway Fixed Advance (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={localPaymentSettings.pickupFixedAdvanceAmount}
                          onChange={(e) =>
                            setLocalPaymentSettings({
                              ...localPaymentSettings,
                              pickupFixedAdvanceAmount: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-mono-num"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Instructions, Remaining Balance Policy & Contact Numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold mb-1">
                      Customer Payment Instructions
                    </label>
                    <textarea
                      rows={4}
                      value={localPaymentSettings.paymentInstructions}
                      onChange={(e) =>
                        setLocalPaymentSettings({
                          ...localPaymentSettings,
                          paymentInstructions: e.target.value,
                        })
                      }
                      className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">
                      Remaining Balance Collection Policy
                    </label>
                    <textarea
                      rows={4}
                      value={localPaymentSettings.remainingBalancePolicy}
                      onChange={(e) =>
                        setLocalPaymentSettings({
                          ...localPaymentSettings,
                          remainingBalancePolicy: e.target.value,
                        })
                      }
                      className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">
                      Payment Verification Phone Number
                    </label>
                    <input
                      type="text"
                      value={localPaymentSettings.verificationPhone}
                      onChange={(e) =>
                        setLocalPaymentSettings({
                          ...localPaymentSettings,
                          verificationPhone: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">
                      WhatsApp Verification Contact Number
                    </label>
                    <input
                      type="text"
                      value={localPaymentSettings.verificationWhatsapp}
                      onChange={(e) =>
                        setLocalPaymentSettings({
                          ...localPaymentSettings,
                          verificationWhatsapp: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                    />
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* 13. SETTINGS, EDITABLE 'OUR STORY' & DELIVERY ZONES TAB */}
          {subPath === 'settings' && (
            <div className="space-y-6">
              <div className="bg-[#FFF8F1] border border-[#E6D7C8] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#3B2824]">
                    Looking for Manual UPI Advance Payment &amp; QR Code Settings?
                  </p>
                  <p className="text-[11px] text-[#6B544E]">
                    Manage your UPI ID, Payee Name, QR code upload, and 20% advance rules in the dedicated Payment Settings console.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin/settings/payments')}
                  className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                >
                  Open Advance Payment Settings &rarr;
                </button>
              </div>
              <form
                onSubmit={handleSaveBusinessSettings}
                className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D7C8] pb-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold">
                      Store Settings &amp; Editable &lsquo;Our Story&rsquo;
                    </h2>
                    <p className="text-xs text-[#6B544E]">
                      Changes saved here immediately update the public website, checkout rules, and `/about` brand narrative.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#B94E62] text-white text-xs font-semibold hover:bg-[#9E3D50] flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Save All Settings &amp; Narrative
                  </button>
                </div>

                {settingsSavedBanner && (
                  <div className="p-3 rounded-xl bg-[#E8F5E9] text-[#2D6A4F] text-xs font-semibold">
                    Business settings and &lsquo;Our Story&rsquo; narrative saved to Firestore!
                  </div>
                )}

                {/* EDITABLE 'OUR STORY' CONTENT AREA */}
                <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#B94E62]">
                    Editable &lsquo;Our Story&rsquo; Brand Narrative (Displayed on /about &amp; Homepage Story)
                  </label>
                  <textarea
                    rows={6}
                    value={localSettings.ourStoryContent || ''}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, ourStoryContent: e.target.value })
                    }
                    className="w-full p-3.5 rounded-xl border border-[#E6D7C8] bg-white text-xs text-[#3B2824] leading-relaxed"
                    placeholder="Write Lovey's Bakery & Pizza Corners brand story..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Announcement Bar (EN)</label>
                    <input
                      type="text"
                      value={localSettings.announcementText}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, announcementText: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Announcement Bar (Hindi)
                    </label>
                    <input
                      type="text"
                      value={localSettings.announcementTextHi}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, announcementTextHi: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={localSettings.phone}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Opening Hours</label>
                    <input
                      type="text"
                      value={localSettings.openingHours}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, openingHours: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                    />
                  </div>
                </div>
              </form>

              {/* Delivery Zones & PIN Code Serviceability */}
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4">
                <h3 className="font-serif text-xl font-bold">
                  Delivery PIN Codes &amp; Locality Fee Rules
                </h3>
                <form
                  onSubmit={handleCreateDeliveryZone}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="PIN Code (e.g. 231217)"
                    value={newZonePin}
                    onChange={(e) => setNewZonePin(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Locality Name"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Fee (₹)"
                    value={newZoneFee}
                    onChange={(e) => setNewZoneFee(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] text-xs font-mono-num"
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={newZoneServiceable}
                      onChange={(e) => setNewZoneServiceable(e.target.checked)}
                    />
                    Serviceable
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                  >
                    Add PIN Zone
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deliveryZones.map((z) => (
                    <div
                      key={z.id}
                      className="p-3.5 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-xs">
                          {z.localityName} · <span className="font-mono-num">{z.pinCode}</span>
                        </p>
                        <p className="text-[11px] text-[#6B544E] font-mono-num">
                          Fee: ₹{z.deliveryFee} · Min Order: ₹{z.minOrderAmount}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-bold ${
                          z.isServiceable ? 'text-[#2D6A4F]' : 'text-[#B94E62]'
                        }`}
                      >
                        {z.isServiceable ? 'Serviceable' : 'Pickup Only'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 14. INVENTORY, RAW MATERIALS & STOCK ADJUSTMENT LEDGER (/admin/inventory) */}
          {subPath === 'inventory' && (
            <BmsInventoryModule
              products={products}
              categories={categories}
              inventoryLogs={inventoryLogs}
              rawMaterials={rawMaterials}
              userEmail={effectiveAdminEmail || 'admin'}
              userRoleName={currentStaffMember.roleName || currentRoleDef.name}
              hasPermission={hasPermission}
              recordAuditLog={recordAuditLog}
            />
          )}

          {/* 15. VISUAL WEBSITE CMS EDITOR (/admin/website/*) */}
          {subPath.startsWith('website') && (
            <BmsWebsiteCmsModule
              subPath={subPath}
              onNavigate={onNavigate}
              websiteConfig={websiteConfig}
              customPages={customPages}
              userEmail={effectiveAdminEmail || 'admin'}
              hasPermission={hasPermission}
              recordAuditLog={recordAuditLog}
            />
          )}

          {/* 16. CUSTOMER RELATIONSHIP MANAGEMENT (/admin/customers) */}
          {subPath === 'customers' && (
            <BmsCrmAndAnalyticsModule
              mode="customers"
              orders={orders}
              orderPayments={orderPayments}
              products={products}
              categories={categories}
              customerCrmNotes={customerCrmNotes}
              userEmail={effectiveAdminEmail || 'admin'}
              hasPermission={hasPermission}
              requestStepUpVerification={requestStepUpVerification}
              recordAuditLog={recordAuditLog}
            />
          )}

          {/* 17. ANALYTICS & FINANCIAL REPORTS (/admin/analytics & /admin/reports) */}
          {(subPath === 'analytics' || subPath === 'reports') && (
            <BmsCrmAndAnalyticsModule
              mode="analytics"
              orders={orders}
              orderPayments={orderPayments}
              products={products}
              categories={categories}
              customerCrmNotes={customerCrmNotes}
              userEmail={effectiveAdminEmail || 'admin'}
              hasPermission={hasPermission}
              requestStepUpVerification={requestStepUpVerification}
              recordAuditLog={recordAuditLog}
            />
          )}

          {/* 18. STAFF & RBAC, PASSWORD SECURITY & BACKUPS, AUDIT LOGS, AND OWNER HELP */}
          {(subPath === 'staff' ||
            subPath === 'security' ||
            subPath === 'activity-logs' ||
            subPath === 'help') && (
            <BmsSecurityAndStaffModule
              subPath={subPath}
              userEmail={effectiveAdminEmail || 'admin'}
              sessionToken={passwordSessionToken}
              onSessionTokenRotated={(newTok) => {
                sessionStorage.setItem('loveys_admin_session_token', newTok);
                setPasswordSessionToken(newTok);
              }}
              currentStaffMember={currentStaffMember}
              staffMembers={staffMembers}
              roleDefinitions={roleDefinitions}
              auditLogs={auditLogs}
              backupRecords={backupRecords}
              allCollectionsSnapshot={{
                categories,
                products,
                cake_designs: cakeDesigns,
                media_assets: mediaAssets,
                coupons,
                delivery_zones: deliveryZones,
                dining_tables: diningTables,
                orders,
                order_payments: orderPayments,
                raw_materials: rawMaterials,
                custom_pages: customPages,
              }}
              inactivityMinutes={inactivityMinutes}
              onChangeInactivityMinutes={handleChangeInactivityMinutes}
              hasPermission={hasPermission}
              requestStepUpVerification={requestStepUpVerification}
              recordAuditLog={recordAuditLog}
            />
          )}

          {/* 19. DEDICATED FULFILMENT & PIN CODE SERVICEABILITY CONSOLE (/admin/fulfilment) */}
          {subPath === 'fulfilment' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
                <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
                  Local Fulfilment, PIN Zones &amp; Preparation Lead Times
                </span>
                <h2 className="font-serif text-2xl font-bold mt-1">
                  Renukoot &amp; Sonbhadra Delivery Zones, Minimum Order Rules &amp; Fulfilment Modes
                </h2>
                <p className="text-xs text-[#6B544E]">
                  Configure serviceable PIN codes, locality delivery charges, free-delivery thresholds, and emergency pause controls for Home Delivery, Takeaway Pickup, and Dine-In QR Ordering.
                </p>
              </div>

              <div className="bg-white border border-[#E6D7C8] rounded-2xl p-6 space-y-4">
                <h3 className="font-serif text-xl font-bold">
                  Add or Update Serviceable PIN Code / Locality Zone
                </h3>
                <form
                  onSubmit={handleCreateDeliveryZone}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="PIN Code (e.g. 231217)"
                    value={newZonePin}
                    onChange={(e) => setNewZonePin(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Locality Name"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Delivery Fee (₹)"
                    value={newZoneFee}
                    onChange={(e) => setNewZoneFee(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-mono-num"
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={newZoneServiceable}
                      onChange={(e) => setNewZoneServiceable(e.target.checked)}
                    />
                    Serviceable for Delivery
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                  >
                    + Add PIN Zone
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {deliveryZones.map((z) => (
                    <div
                      key={z.id}
                      className="p-4 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-xs">
                          {z.localityName} · <span className="font-mono-num">{z.pinCode}</span>
                        </p>
                        <p className="text-[11px] text-[#6B544E] font-mono-num">
                          Delivery Fee: ₹{z.deliveryFee} · Min Order: ₹{z.minOrderAmount}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          z.isServiceable
                            ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                            : 'bg-[#FFF5F5] text-[#B94E62]'
                        }`}
                      >
                        {z.isServiceable ? 'Serviceable' : 'Pickup Only'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bulk CSV Product Import Modal */}
          {csvImportModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white border border-[#E6D7C8] rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between border-b border-[#E6D7C8] pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                      Server-Validated CSV Product Importer
                    </span>
                    <h3 className="font-serif text-xl font-bold">
                      Bulk Import Products via CSV
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvImportModalOpen(false);
                      setCsvValidationResult(null);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>

                <p className="text-xs text-[#6B544E]">
                  Required CSV headers: <code>name, categoryId, basePrice</code> (optional:{' '}
                  <code>nameHi, stockQuantity, minStockThreshold, isVeg, isAvailable, description</code>).
                </p>

                <textarea
                  rows={6}
                  value={csvTextInput}
                  onChange={(e) => setCsvTextInput(e.target.value)}
                  placeholder={
                    'name,nameHi,categoryId,basePrice,stockQuantity,minStockThreshold,description\nBelgian Truffle Pastry,बेल्जियन ट्रफल पेस्ट्री,cat-pastries-desserts,120,30,5,Rich dark chocolate ganache pastry'
                  }
                  className="w-full p-3 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num text-xs"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleValidateCsvImport}
                    className="px-4 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold"
                  >
                    1. Validate CSV Rows on Server
                  </button>
                  {csvValidationResult && csvValidationResult.validCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCommitCsvImport}
                      className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white text-xs font-bold"
                    >
                      2. Commit {csvValidationResult.validCount} Valid Product(s) to Database
                    </button>
                  )}
                </div>

                {csvValidationResult && (
                  <div className="p-3.5 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] text-xs space-y-2">
                    <p className="font-bold">
                      Validation Summary: {csvValidationResult.validCount} valid row(s),{' '}
                      {csvValidationResult.errorCount} error(s)
                    </p>
                    {csvValidationResult.rowErrors.map((err, i) => (
                      <p key={i} className="text-[#B94E62]">
                        Row #{err.rowNumber}: {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
