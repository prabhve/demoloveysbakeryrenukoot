import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  updatePassword,
} from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import {
  StaffMemberRecord,
  RoleDefinitionRecord,
  AuditLogRecord,
  BackupRecordItem,
  BmsPermissionKey,
} from '../../data/initialCatalogue';
import {
  Shield,
  Users,
  Key,
  Lock,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  LogOut,
  Copy,
} from 'lucide-react';

interface ActiveSessionInfo {
  sessionId: string;
  accountId: string;
  email: string;
  username: string;
  name: string;
  roleName: string;
  ipAddress: string;
  userAgent: string;
  rememberDevice: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: number;
  isCurrent: boolean;
}

interface LoginHistoryItem {
  id: string;
  emailOrUsername: string;
  accountId?: string;
  roleName?: string;
  ipAddress: string;
  userAgent: string;
  outcome:
    | 'success'
    | 'failure'
    | 'lockout'
    | 'password_changed'
    | 'email_changed'
    | 'password_reset'
    | 'session_revoked';
  reason: string;
  suspicious: boolean;
  createdAt: string;
}

interface BmsSecurityAndStaffModuleProps {
  subPath: string;
  userEmail: string;
  sessionToken: string;
  onSessionTokenRotated?: (newToken: string) => void;
  onAccountUpdated?: (updatedAccount: StaffMemberRecord, newToken?: string) => void;
  currentStaffMember: StaffMemberRecord;
  staffMembers: StaffMemberRecord[];
  roleDefinitions: RoleDefinitionRecord[];
  auditLogs: AuditLogRecord[];
  backupRecords: BackupRecordItem[];
  allCollectionsSnapshot: Record<string, any[]>;
  inactivityMinutes: number;
  onChangeInactivityMinutes: (mins: number) => void;
  hasPermission: (perm: string) => boolean;
  requestStepUpVerification: (actionLabel: string, onVerified: () => void) => void;
  recordAuditLog: (
    entityType: string,
    action: string,
    entityId: string,
    summary: string
  ) => Promise<void>;
}

const ALL_PERMISSION_KEYS: Array<{ key: BmsPermissionKey; label: string }> = [
  { key: 'view', label: 'View Dashboards' },
  { key: 'create', label: 'Create Items' },
  { key: 'edit', label: 'Edit Items & Stock' },
  { key: 'publish', label: 'Publish Live CMS' },
  { key: 'delete_archive', label: 'Archive / Delete' },
  { key: 'export_csv', label: 'Export CSV Data' },
  { key: 'approve_orders', label: 'Confirm / Cancel Orders' },
  { key: 'verify_payments', label: 'Verify UPI Payments' },
  { key: 'manage_settings', label: 'Store & Payment Settings' },
  { key: 'invite_staff', label: 'Manage Staff & RBAC' },
];

function parsePerms(summary?: string): BmsPermissionKey[] {
  return (summary || '')
    .split(',')
    .map((p) => p.trim() as BmsPermissionKey)
    .filter(Boolean);
}

function generateStrongPassphrase(): string {
  const words = [
    'Truffle',
    'Pistachio',
    'Saffron',
    'Artisan',
    'Renukoot',
    'Ganache',
    'Croissant',
    'Velvet',
    'Margherita',
    'Cardamom',
    'Hazelnut',
    'Bakehouse',
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${pick()}-${pick()}-${pick()}-${num}!`;
}

export const BmsSecurityAndStaffModule: React.FC<BmsSecurityAndStaffModuleProps> = ({
  subPath,
  userEmail,
  sessionToken,
  onSessionTokenRotated,
  onAccountUpdated,
  currentStaffMember,
  staffMembers,
  roleDefinitions,
  auditLogs,
  backupRecords,
  allCollectionsSnapshot,
  inactivityMinutes,
  onChangeInactivityMinutes,
  hasPermission,
  requestStepUpVerification,
  recordAuditLog,
}) => {
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Staff Account Creation State (Individual Password-Only Accounts)
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRoleId, setNewStaffRoleId] = useState('role-manager');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showNewStaffPassword, setShowNewStaffPassword] = useState(false);
  const [requireFirstLoginChange, setRequireFirstLoginChange] = useState(true);
  const [staffResetLinkModal, setStaffResetLinkModal] = useState<{
    staffName: string;
    email: string;
    recoveryLinkPath: string;
  } | null>(null);

  // Custom Role Form State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<BmsPermissionKey[]>(['view', 'edit']);

  // Password Change State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Registered Email & Profile Change State (Account Settings)
  const [newEmailInput, setNewEmailInput] = useState(currentStaffMember.email || userEmail || '');
  const [newUsernameInput, setNewUsernameInput] = useState(
    currentStaffMember.username || 'owner'
  );
  const [newDisplayNameInput, setNewDisplayNameInput] = useState(
    currentStaffMember.name || "Lovey's Principal Owner"
  );
  const [emailChangeCurrentPassword, setEmailChangeCurrentPassword] = useState('');
  const [showEmailChangePassword, setShowEmailChangePassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    setNewEmailInput(currentStaffMember.email || userEmail || '');
    setNewUsernameInput(currentStaffMember.username || 'owner');
    setNewDisplayNameInput(currentStaffMember.name || "Lovey's Principal Owner");
  }, [currentStaffMember.email, currentStaffMember.username, currentStaffMember.name, userEmail]);

  // Security Overview State (Active Sessions, Login History, Suspicious Attempts)
  const [activeSessions, setActiveSessions] = useState<ActiveSessionInfo[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [suspiciousAttempts, setSuspiciousAttempts] = useState<LoginHistoryItem[]>([]);
  const [serverAccounts, setServerAccounts] = useState<StaffMemberRecord[]>([]);
  const [loadingSecurityOverview, setLoadingSecurityOverview] = useState(false);

  // Audit Log Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('all');

  // Restore JSON Backup State
  const [restoringBackup, setRestoringBackup] = useState(false);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    }),
    [sessionToken]
  );

  const fetchSecurityOverview = useCallback(async () => {
    setLoadingSecurityOverview(true);
    try {
      const res = await fetch('/api/admin/auth/security-overview', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSessions(Array.isArray(data.activeSessions) ? data.activeSessions : []);
        setLoginHistory(Array.isArray(data.loginHistory) ? data.loginHistory : []);
        setSuspiciousAttempts(
          Array.isArray(data.suspiciousAttempts) ? data.suspiciousAttempts : []
        );
        if (Array.isArray(data.accounts)) {
          setServerAccounts(data.accounts);
        }
      }
    } catch (err) {
      console.warn('Security overview fetch:', err);
    } finally {
      setLoadingSecurityOverview(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (subPath === 'security' || subPath === 'staff') {
      fetchSecurityOverview();
    }
  }, [subPath, fetchSecurityOverview]);

  // Combine Firestore staffMembers with server-registered staff accounts so none are missed
  const combinedStaffList: StaffMemberRecord[] = React.useMemo(() => {
    const map = new Map<string, StaffMemberRecord>();
    staffMembers.forEach((s) => map.set(s.email.toLowerCase(), s));
    serverAccounts.forEach((sa) => {
      const key = sa.email.toLowerCase();
      const existing = map.get(key);
      map.set(key, existing ? { ...existing, ...sa } : sa);
    });
    return Array.from(map.values());
  }, [staffMembers, serverAccounts]);

  const handleCreateStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!hasPermission('invite_staff')) {
      setErrorMsg('Your current role does not have permission to create or modify staff accounts.');
      return;
    }

    const cleanEmail = newStaffEmail.trim().toLowerCase();
    const cleanUsername =
      newStaffUsername.trim().toLowerCase() ||
      cleanEmail.split('@')[0].replace(/[^a-z0-9_.-]/g, '');

    if (!cleanEmail || !newStaffName.trim()) {
      setErrorMsg('Staff member full name and email address are required.');
      return;
    }
    if (newStaffPassword.length < 12) {
      setErrorMsg(
        'Initial staff password must be at least 12 characters long (strong password policy enforced).'
      );
      return;
    }

    const selectedRole =
      roleDefinitions.find((r) => r.id === newStaffRoleId) || roleDefinitions[1];

    requestStepUpVerification(`Create Individual Staff Account (${cleanEmail})`, async () => {
      const id = `staff-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
      const nowIso = new Date().toISOString();

      try {
        const res = await fetch('/api/admin/auth/staff-credentials', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            action: 'create_or_update',
            id,
            email: cleanEmail,
            username: cleanUsername,
            name: newStaffName.trim(),
            phone: newStaffPhone.trim(),
            roleId: selectedRole.id,
            roleName: selectedRole.name,
            permissionsSummary: selectedRole.permissionsSummary,
            initialPassword: newStaffPassword,
            requirePasswordChange: requireFirstLoginChange,
            sessionTimeoutMinutes: inactivityMinutes,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to register staff credentials.');
          return;
        }

        const rec: StaffMemberRecord = {
          id,
          email: cleanEmail,
          username: cleanUsername,
          name: newStaffName.trim(),
          phone: newStaffPhone.trim(),
          roleId: selectedRole.id,
          roleName: selectedRole.name,
          permissionsSummary: selectedRole.permissionsSummary,
          status: 'active',
          requirePasswordChange: requireFirstLoginChange,
          sessionVersion: 1,
          sessionTimeoutMinutes: inactivityMinutes,
          passwordUpdatedAt: nowIso,
          invitedByEmail: userEmail,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        try {
          await setDoc(doc(db, 'staff_members', id), rec);
        } catch (fsErr) {
          console.warn('Firestore staff sync:', fsErr);
        }

        await recordAuditLog(
          'staff',
          'STAFF_ACCOUNT_CREATED',
          id,
          `Created individual password account for ${rec.name} (${rec.email} / @${rec.username}) as ${rec.roleName}`
        );

        setNewStaffEmail('');
        setNewStaffUsername('');
        setNewStaffName('');
        setNewStaffPhone('');
        setNewStaffPassword('');
        await fetchSecurityOverview();
        setBannerMsg(
          `Created individual account for ${rec.name} (${rec.email}). They can now sign in at /admin/login with their assigned password.`
        );
        setTimeout(() => setBannerMsg(null), 5000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to create staff account.');
      }
    });
  };

  const handleToggleStaffStatus = (staff: StaffMemberRecord) => {
    setErrorMsg(null);
    if (
      staff.roleId === 'role-owner' ||
      staff.email.toLowerCase() === 'prabhve5@gmail.com' ||
      staff.email.toLowerCase() === 'owner@loveys-demo.test'
    ) {
      setErrorMsg('The Principal Owner account cannot be deactivated.');
      return;
    }
    const nextStatus = staff.status === 'active' ? 'suspended' : 'active';
    requestStepUpVerification(
      `${nextStatus === 'suspended' ? 'Deactivate' : 'Reactivate'} Staff Account (${staff.email})`,
      async () => {
        try {
          const res = await fetch('/api/admin/auth/staff-credentials', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              action: 'set_status',
              id: staff.id,
              status: nextStatus,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setErrorMsg(data.error || 'Failed to update staff account status.');
            return;
          }

          try {
            await setDoc(doc(db, 'staff_members', staff.id), {
              ...staff,
              status: nextStatus,
              sessionVersion: (staff.sessionVersion || 1) + 1,
              updatedAt: new Date().toISOString(),
            });
          } catch (fsErr) {
            console.warn('Firestore status sync:', fsErr);
          }

          await recordAuditLog(
            'staff',
            nextStatus === 'suspended' ? 'STAFF_DEACTIVATED' : 'STAFF_REACTIVATED',
            staff.id,
            `Changed ${staff.email} status to ${nextStatus} and revoked active sessions`
          );
          await fetchSecurityOverview();
          setBannerMsg(`Updated ${staff.name} status to ${nextStatus.toUpperCase()}.`);
          setTimeout(() => setBannerMsg(null), 3500);
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to update staff status.');
        }
      }
    );
  };

  const handleForceStaffPasswordReset = (staff: StaffMemberRecord) => {
    setErrorMsg(null);
    requestStepUpVerification(`Force Password Reset & Revoke Sessions (${staff.email})`, async () => {
      try {
        const res = await fetch('/api/admin/auth/staff-credentials', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            action: 'force_password_reset',
            id: staff.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to generate password reset link.');
          return;
        }

        try {
          await setDoc(doc(db, 'staff_members', staff.id), {
            ...staff,
            requirePasswordChange: true,
            sessionVersion: (staff.sessionVersion || 1) + 1,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // ignore if offline
        }

        await recordAuditLog(
          'staff',
          'STAFF_FORCE_PASSWORD_RESET',
          staff.id,
          `Forced password reset and revoked active sessions for ${staff.email}`
        );
        await fetchSecurityOverview();

        if (data.recoveryLinkPath) {
          setStaffResetLinkModal({
            staffName: staff.name,
            email: staff.email,
            recoveryLinkPath: data.recoveryLinkPath,
          });
        }
        setBannerMsg(
          `All sessions for ${staff.name} were revoked and a single-use 15-minute password recovery link was generated.`
        );
        setTimeout(() => setBannerMsg(null), 4500);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to force password reset.');
      }
    });
  };

  const handleRevokeStaffSessions = async (staff: StaffMemberRecord) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/auth/sessions/revoke', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetAccountId: staff.id }),
      });
      const data = await res.json();
      if (res.ok) {
        await recordAuditLog(
          'security',
          'STAFF_SESSIONS_REVOKED',
          staff.id,
          `Revoked ${data.revokedCount || 0} active session(s) for ${staff.email}`
        );
        await fetchSecurityOverview();
        setBannerMsg(`Revoked all active sessions for ${staff.name}.`);
        setTimeout(() => setBannerMsg(null), 3500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke sessions.');
    }
  };

  const handleToggleRolePermission = async (
    role: RoleDefinitionRecord,
    permKey: BmsPermissionKey
  ) => {
    if (role.id === 'role-owner') {
      setErrorMsg('Owner / Super Admin permissions are locked to full access.');
      return;
    }
    const currentList = parsePerms(role.permissionsSummary);
    const hasPerm = currentList.includes(permKey);
    const updatedPerms = hasPerm
      ? currentList.filter((p) => p !== permKey)
      : [...currentList, permKey];

    const updatedRole: RoleDefinitionRecord = {
      ...role,
      permissionsSummary: updatedPerms.join(','),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'role_definitions', role.id), updatedRole);
      await recordAuditLog(
        'staff',
        'ROLE_PERMISSIONS_UPDATED',
        role.id,
        `Updated permission "${permKey}" on role "${role.name}"`
      );
    } catch (err: any) {
      console.warn('Role permission update:', err?.message || err);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const id = `role-custom-${Date.now()}`;
    const rec: RoleDefinitionRecord = {
      id,
      name: newRoleName.trim(),
      description: newRoleDesc.trim() || 'Custom owner-defined role',
      isSystemRole: false,
      permissionsSummary: newRolePerms.join(','),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'role_definitions', id), rec);
      await recordAuditLog('staff', 'CUSTOM_ROLE_CREATED', id, `Created custom role ${rec.name}`);
    } catch (err: any) {
      console.warn('Custom role create:', err?.message || err);
    }
    setNewRoleName('');
    setNewRoleDesc('');
    setBannerMsg(`Created custom role "${rec.name}".`);
    setTimeout(() => setBannerMsg(null), 3500);
  };

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBannerMsg(null);

    if (newPasswordInput.length < 12) {
      setErrorMsg('New password must be at least 12 characters long.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Password change failed.');
        return;
      }

      if (data.sessionToken && onSessionTokenRotated) {
        onSessionTokenRotated(data.sessionToken);
      }
      if (data.account && onAccountUpdated) {
        onAccountUpdated(data.account, data.sessionToken);
      }

      // Sync updated password status to Firestore staff_members profile
      try {
        await setDoc(doc(db, 'staff_members', currentStaffMember.id), {
          ...currentStaffMember,
          ...(data.account || {}),
          requirePasswordChange: false,
          mustChangePassword: false,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Non-blocking Firestore sync when signed in via server session
      }

      // If also signed into Firebase Auth via Email/Password, synchronize Firebase Auth password
      if (
        auth.currentUser &&
        auth.currentUser.email &&
        auth.currentUser.providerData.some((p) => p.providerId === 'password')
      ) {
        try {
          const cred = EmailAuthProvider.credential(
            auth.currentUser.email,
            currentPasswordInput
          );
          await reauthenticateWithCredential(auth.currentUser, cred);
          await updatePassword(auth.currentUser, newPasswordInput);
        } catch (fbErr: any) {
          console.warn('Firebase Auth password sync note:', fbErr?.code || fbErr?.message);
        }
      }

      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      await recordAuditLog(
        'security',
        'ADMIN_PASSWORD_CHANGED',
        currentStaffMember.id,
        `Password changed for ${userEmail}; mustChangePassword cleared and all previous sessions invalidated`
      );
      await fetchSecurityOverview();
      setBannerMsg(
        'Password updated! All previous sessions on other devices have been automatically invalidated.'
      );
      setTimeout(() => setBannerMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Registered Email & Owner Profile Update Handler (with Current Password Reauthentication)
  const handleChangeRegisteredEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBannerMsg(null);

    const cleanNewEmail = newEmailInput.trim().toLowerCase();
    const cleanNewUsername = newUsernameInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '');
    const cleanNewName = newDisplayNameInput.trim();

    if (!cleanNewEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!emailChangeCurrentPassword) {
      setErrorMsg('Please enter your current password to reauthenticate before changing your email.');
      return;
    }

    setChangingEmail(true);
    try {
      const res = await fetch('/api/admin/auth/change-email', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          currentPassword: emailChangeCurrentPassword,
          newEmail: cleanNewEmail,
          newUsername: cleanNewUsername,
          newName: cleanNewName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update registered email.');
        return;
      }

      if (data.sessionToken && onSessionTokenRotated) {
        onSessionTokenRotated(data.sessionToken);
      }
      if (data.account && onAccountUpdated) {
        onAccountUpdated(data.account, data.sessionToken);
      }

      // Sync updated owner/staff profile to Firestore staff_members collection
      try {
        await setDoc(doc(db, 'staff_members', currentStaffMember.id), {
          ...currentStaffMember,
          ...(data.account || {}),
          email: cleanNewEmail,
          username: cleanNewUsername || currentStaffMember.username,
          name: cleanNewName || currentStaffMember.name,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Non-blocking if Firestore write requires matching Firebase Auth token
      }

      // If signed into Firebase Auth with Email/Password, also trigger Firebase reauthentication & verifyBeforeUpdateEmail
      let firebaseVerificationNote = '';
      if (
        auth.currentUser &&
        auth.currentUser.email &&
        auth.currentUser.providerData.some((p) => p.providerId === 'password')
      ) {
        try {
          const cred = EmailAuthProvider.credential(
            auth.currentUser.email,
            emailChangeCurrentPassword
          );
          await reauthenticateWithCredential(auth.currentUser, cred);
          await verifyBeforeUpdateEmail(auth.currentUser, cleanNewEmail);
          firebaseVerificationNote =
            ' A Firebase Auth verification email has also been dispatched to the new address.';
        } catch (fbErr: any) {
          firebaseVerificationNote = ` (Firebase Auth note: ${fbErr?.code || 'provider sync skipped'})`;
        }
      }

      setEmailChangeCurrentPassword('');
      await recordAuditLog(
        'security',
        'ADMIN_EMAIL_CHANGED',
        currentStaffMember.id,
        `Registered admin email updated from ${data.previousEmail || userEmail} to ${cleanNewEmail}`
      );
      await fetchSecurityOverview();
      setBannerMsg(
        `${data.message || `Registered email updated to ${cleanNewEmail}.`}${firebaseVerificationNote}`
      );
      setTimeout(() => setBannerMsg(null), 6500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update registered email.');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleRevokeSession = async (sessionId?: string, revokeAllOthers = false) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/auth/sessions/revoke', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sessionId, revokeAllOthers }),
      });
      const data = await res.json();
      if (res.ok) {
        await recordAuditLog(
          'security',
          'SESSION_REVOKED',
          sessionId || 'all_other_sessions',
          `Revoked ${data.revokedCount || 0} active session(s)`
        );
        await fetchSecurityOverview();
        setBannerMsg(`Revoked ${data.revokedCount || 0} session(s).`);
        setTimeout(() => setBannerMsg(null), 3500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke session.');
    }
  };

  // Create & Download Verified SHA-256 Database Backup Snapshot
  const handleCreateVerifiedBackup = async () => {
    requestStepUpVerification('Generate & Download Full Database Backup Snapshot', async () => {
      try {
        const snapshotPayload = {
          business: "Lovey's Bakery & Pizza Corners, Renukoot",
          exportedAt: new Date().toISOString(),
          exportedBy: userEmail,
          collections: allCollectionsSnapshot,
        };

        const res = await fetch('/api/admin/backup/verify-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotPayload }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Backup verification failed.');
          return;
        }

        const backupId = `bkp-${Date.now()}`;
        const rec: BackupRecordItem = {
          id: backupId,
          label: `Full BMS Snapshot (${new Date().toLocaleDateString('en-IN')})`,
          collectionsIncluded: Object.keys(allCollectionsSnapshot).join(', '),
          totalDocumentsCount: Number(data.totalDocuments || 0),
          sizeBytes: Number(data.byteSize || 0),
          checksumSha256: data.checksumSha256,
          createdByEmail: userEmail,
          status: 'verified',
          createdAt: data.verifiedAt || new Date().toISOString(),
        };

        try {
          await setDoc(doc(db, 'backup_records', backupId), rec);
        } catch (fsErr) {
          console.warn('Backup record log:', fsErr);
        }
        await recordAuditLog(
          'security',
          'DATABASE_BACKUP_EXPORTED',
          backupId,
          `Exported verified JSON snapshot (${rec.totalDocumentsCount} documents, SHA-256: ${String(
            rec.checksumSha256 || ''
          ).slice(0, 12)}...)`
        );

        const blob = new Blob([JSON.stringify(snapshotPayload, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loveys-bms-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        setBannerMsg(
          `Verified backup downloaded (${rec.totalDocumentsCount} documents · SHA-256 checksum recorded).`
        );
        setTimeout(() => setBannerMsg(null), 4500);
      } catch (err: any) {
        setErrorMsg(err.message || 'Backup export failed.');
      }
    });
  };

  const handleRestoreBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    requestStepUpVerification('Restore Database Collections from JSON Snapshot', () => {
      setRestoringBackup(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          if (!parsed.collections || typeof parsed.collections !== 'object') {
            setErrorMsg('Invalid backup JSON file: missing "collections" object.');
            setRestoringBackup(false);
            return;
          }

          const batch = writeBatch(db);
          let restoredDocs = 0;

          const safeCollections = [
            'categories',
            'products',
            'cake_designs',
            'media_assets',
            'coupons',
            'delivery_zones',
            'dining_tables',
            'raw_materials',
            'custom_pages',
          ];

          for (const colName of safeCollections) {
            const docs = parsed.collections[colName];
            if (Array.isArray(docs)) {
              for (const d of docs) {
                if (d && d.id) {
                  batch.set(doc(db, colName, String(d.id)), d);
                  restoredDocs++;
                }
              }
            }
          }

          await batch.commit();
          await recordAuditLog(
            'security',
            'DATABASE_BACKUP_RESTORED',
            file.name,
            `Restored ${restoredDocs} documents from backup file "${file.name}"`
          );
          setBannerMsg(
            `Successfully restored ${restoredDocs} catalogue & configuration documents from "${file.name}".`
          );
          setTimeout(() => setBannerMsg(null), 5000);
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to parse or restore backup JSON.');
        } finally {
          setRestoringBackup(false);
        }
      };
      reader.readAsText(file);
    });
  };

  // ============================================================================
  // VIEW 1: STAFF ACCOUNTS & RBAC PERMISSION MATRIX (/admin/staff)
  // ============================================================================
  if (subPath === 'staff') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
              Individual Staff Accounts &amp; Role-Based Access Control (RBAC)
            </span>
            <h2 className="font-serif text-2xl font-bold mt-1">
              Staff Password Provisioning, Roles &amp; Granular Permissions
            </h2>
            <p className="text-xs text-[#6B544E]">
              Every administrator and employee has an individual registered account with a 12+ character password. Shared staff passwords and public admin sign-up are strictly disabled.
            </p>
          </div>
        </div>

        {bannerMsg && (
          <div className="p-3.5 rounded-2xl bg-[#E8F5E9] text-[#2D6A4F] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#FFF5F5] text-[#B94E62] text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Staff Account Creation & Directory */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateStaffAccount}
            className="lg:col-span-4 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-3.5 h-fit text-xs"
          >
            <h3 className="font-serif text-lg font-bold">
              Create Individual Staff Account
            </h3>
            <p className="text-[#6B544E]">
              Assign an individual login email, username, role, and initial 12+ character password.
            </p>
            <div>
              <label className="block font-bold mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="e.g. Rahul Verma (Kitchen Lead)"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1">Staff Email Address</label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="kitchen@loveysbakery.in"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Username</label>
                <input
                  type="text"
                  value={newStaffUsername}
                  onChange={(e) => setNewStaffUsername(e.target.value)}
                  placeholder="rahul_kitchen"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold mb-1">Contact Phone</label>
              <input
                type="text"
                value={newStaffPhone}
                onChange={(e) => setNewStaffPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Assigned Role</label>
              <select
                value={newStaffRoleId}
                onChange={(e) => setNewStaffRoleId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-semibold"
              >
                {roleDefinitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold">Initial Password (Min 12 Chars)</label>
                <button
                  type="button"
                  onClick={() => {
                    setNewStaffPassword(generateStrongPassphrase());
                    setShowNewStaffPassword(true);
                  }}
                  className="text-[11px] font-bold text-[#B94E62] hover:underline"
                >
                  Generate Passphrase
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNewStaffPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Minimum 12 characters or passphrase"
                  className="w-full pl-3 pr-9 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
                <button
                  type="button"
                  onClick={() => setShowNewStaffPassword(!showNewStaffPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B544E] hover:text-[#3B2824]"
                  title={showNewStaffPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showNewStaffPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 font-semibold text-[#3B2824] pt-1">
              <input
                type="checkbox"
                checked={requireFirstLoginChange}
                onChange={(e) => setRequireFirstLoginChange(e.target.checked)}
              />
              Require password change at first login
            </label>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-semibold hover:bg-[#B94E62] flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Staff Account
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-[#E6D7C8] rounded-2xl p-5">
            <h3 className="font-serif text-lg font-bold mb-3">
              Registered Administrators &amp; Staff Accounts ({combinedStaffList.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2.5 pr-3">Staff Member</th>
                    <th className="py-2.5 pr-3">Role</th>
                    <th className="py-2.5 pr-3">Password Policy</th>
                    <th className="py-2.5 pr-3">Last Login</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5">Security Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {combinedStaffList.map((st) => (
                    <tr key={st.id}>
                      <td className="py-3 pr-3">
                        <p className="font-bold text-[#3B2824]">{st.name}</p>
                        <p className="font-mono-num text-[11px] text-[#6B544E]">
                          {st.email} {st.username ? `(@${st.username})` : ''}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="px-2.5 py-1 rounded-lg bg-[#F5EBE1] text-[#3B2824] font-bold text-[11px]">
                          {st.roleName}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            st.requirePasswordChange || st.mustChangePassword
                              ? 'bg-[#FFF4E5] text-[#B36B00]'
                              : 'bg-[#E8F5E9] text-[#2D6A4F]'
                          }`}
                        >
                          {st.requirePasswordChange || st.mustChangePassword
                            ? 'Must Change on Login'
                            : '12+ Char Scrypt Hash'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono-num text-[11px] text-[#6B544E]">
                        {st.lastLoginAt
                          ? new Date(st.lastLoginAt).toLocaleString('en-IN')
                          : 'Never'}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] uppercase ${
                            st.status === 'active'
                              ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                              : 'bg-[#FFF5F5] text-[#B94E62]'
                          }`}
                        >
                          {st.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleForceStaffPasswordReset(st)}
                            className="px-2.5 py-1 rounded-lg border border-[#E6D7C8] bg-[#FFF8F1] hover:bg-[#F5EBE1] font-semibold text-[11px]"
                            title="Invalidate sessions and generate 15-minute password reset link"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeStaffSessions(st)}
                            className="px-2.5 py-1 rounded-lg border border-[#E6D7C8] bg-white hover:bg-[#F5EBE1] font-semibold text-[11px]"
                            title="Force logout active sessions"
                          >
                            Revoke Sessions
                          </button>
                          {st.roleId !== 'role-owner' &&
                            st.email.toLowerCase() !== 'prabhve5@gmail.com' &&
                            st.email.toLowerCase() !== 'owner@loveys-demo.test' && (
                              <button
                                type="button"
                                onClick={() => handleToggleStaffStatus(st)}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                                  st.status === 'active'
                                    ? 'bg-[#FFF5F5] text-[#B94E62]'
                                    : 'bg-[#E8F5E9] text-[#2D6A4F]'
                                }`}
                              >
                                {st.status === 'active' ? 'Deactivate' : 'Reactivate'}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Single-Use Staff Password Reset Link Modal */}
        {staffResetLinkModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E6D7C8] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
                  Single-Use 15-Minute Password Recovery Link
                </span>
                <button
                  type="button"
                  onClick={() => setStaffResetLinkModal(null)}
                  className="text-xs font-bold text-[#6B544E]"
                >
                  Close
                </button>
              </div>
              <h3 className="font-serif text-xl font-bold text-[#3B2824]">
                Password Reset Link for {staffResetLinkModal.staffName}
              </h3>
              <p className="text-xs text-[#6B544E]">
                All previous sessions for <strong>{staffResetLinkModal.email}</strong> have been invalidated. Share this time-limited (15-minute), single-use recovery link with the staff member so they can set a new 12+ character password:
              </p>
              <div className="p-3 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] font-mono-num text-xs break-all">
                {window.location.origin}
                {staffResetLinkModal.recoveryLinkPath}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}${staffResetLinkModal.recoveryLinkPath}`
                    );
                    setBannerMsg('Copied single-use password reset link to clipboard.');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Recovery Link
                </button>
                <button
                  type="button"
                  onClick={() => setStaffResetLinkModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Role & Granular Permission Matrix */}
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-bold">
                Role Definitions &amp; Granular Permission Matrix
              </h3>
              <p className="text-xs text-[#6B544E]">
                Toggle permissions per role or create a custom role below.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                  <th className="py-2.5 pr-3">Role Name</th>
                  {ALL_PERMISSION_KEYS.map((pk) => (
                    <th key={pk.key} className="py-2.5 px-2 text-center">
                      {pk.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7C8]">
                {roleDefinitions.map((role) => {
                  const rolePerms = parsePerms(role.permissionsSummary);
                  return (
                    <tr key={role.id}>
                      <td className="py-3 pr-3">
                        <p className="font-bold text-[#3B2824]">{role.name}</p>
                        <p className="text-[11px] text-[#6B544E]">{role.description}</p>
                      </td>
                      {ALL_PERMISSION_KEYS.map((pk) => {
                        const checked = rolePerms.includes(pk.key);
                        return (
                          <td key={pk.key} className="py-3 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={role.id === 'role-owner'}
                              onChange={() => handleToggleRolePermission(role, pk.key)}
                              className="w-4 h-4 accent-[#3B2824]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Custom Role Builder */}
          <form
            onSubmit={handleCreateCustomRole}
            className="pt-4 border-t border-[#E6D7C8] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
          >
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="New Custom Role Name (e.g. Evening Cashier)"
              className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
            />
            <input
              type="text"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="Role description & scope"
              className="px-3 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-semibold"
            >
              + Create Custom Role
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: PASSWORD SECURITY, ACTIVE SESSIONS & BACKUPS (/admin/security)
  // ============================================================================
  if (subPath === 'security') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
              Hardened Password Security, Sessions &amp; Verified Backups
            </span>
            <h2 className="font-serif text-2xl font-bold mt-1">
              Password Management, Active Device Sessions, Login History &amp; Snapshots
            </h2>
            <p className="text-xs text-[#6B544E]">
              Protected by 12+ character Scrypt password hashing, brute-force lockout, progressive delays, CSRF protection, and automatic session invalidation on password change.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSecurityOverview}
            className="px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] hover:bg-[#F5EBE1] text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSecurityOverview ? 'animate-spin' : ''}`} />
            Refresh Security Monitor
          </button>
        </div>

        {bannerMsg && (
          <div className="p-3.5 rounded-2xl bg-[#E8F5E9] text-[#2D6A4F] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#FFF5F5] text-[#B94E62] text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Owner & Admin Account Settings — Replace Demo Email / Update Registered Email & Username */}
          <form
            onSubmit={handleChangeRegisteredEmail}
            className="lg:col-span-6 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F]">
                  Account Settings &amp; Owner Handover
                </span>
                <h3 className="font-serif text-lg font-bold mt-0.5">
                  Change Registered Email, Username &amp; Display Name
                </h3>
              </div>
              <Shield className="w-5 h-5 text-[#3B2824]" />
            </div>

            {(currentStaffMember.email || userEmail).toLowerCase().endsWith('.test') && (
              <div className="p-3 rounded-xl bg-[#FFF4E5] border border-[#B36B00]/30 text-[#B36B00] space-y-1">
                <p className="font-bold">Initial Demo Email Active ({currentStaffMember.email || userEmail})</p>
                <p className="text-[11px]">
                  Replace <code>owner@loveys-demo.test</code> below with the actual bakery owner&apos;s permanent email address. Current password reauthentication is required.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Registered Login Email</label>
                <input
                  type="email"
                  required
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="owner@loveysbakery.in"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Admin Username</label>
                <input
                  type="text"
                  required
                  value={newUsernameInput}
                  onChange={(e) => setNewUsernameInput(e.target.value)}
                  placeholder="owner"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Owner / Administrator Display Name</label>
              <input
                type="text"
                required
                value={newDisplayNameInput}
                onChange={(e) => setNewDisplayNameInput(e.target.value)}
                placeholder="Lovey's Principal Owner"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">
                Current Password (Required for Reauthentication)
              </label>
              <div className="relative">
                <input
                  type={showEmailChangePassword ? 'text' : 'password'}
                  required
                  value={emailChangeCurrentPassword}
                  onChange={(e) => setEmailChangeCurrentPassword(e.target.value)}
                  placeholder="Enter your current password to confirm email change"
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
                <button
                  type="button"
                  onClick={() => setShowEmailChangePassword(!showEmailChangePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
                >
                  {showEmailChangePassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={changingEmail}
              className="w-full py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold hover:bg-[#23533D] disabled:opacity-50"
            >
              {changingEmail
                ? 'Reauthenticating & Updating Registered Email...'
                : 'Update Registered Email & Profile'}
            </button>
          </form>

          {/* Change Admin Password Card */}
          <form
            onSubmit={handleChangePassword}
            className="lg:col-span-6 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B94E62]">
                  Strong Password Policy (12+ Characters)
                </span>
                <h3 className="font-serif text-lg font-bold mt-0.5">
                  Change Your Admin Password
                </h3>
              </div>
              <Key className="w-5 h-5 text-[#3B2824]" />
            </div>

            <p className="text-[#6B544E]">
              Changing your password immediately increments your account session version and invalidates all previous sessions on other browsers or devices.
            </p>

            <div>
              <label className="block font-bold mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold">
                  New Password or Passphrase (Min 12 Characters)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const gen = generateStrongPassphrase();
                    setNewPasswordInput(gen);
                    setConfirmNewPasswordInput(gen);
                    setShowNewPassword(true);
                  }}
                  className="text-[11px] font-bold text-[#B94E62] hover:underline"
                >
                  Suggest Strong Passphrase
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={12}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="At least 12 chars (letters + numbers/symbols or passphrase)"
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B544E]"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Confirm New Password</label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={12}
                value={confirmNewPasswordInput}
                onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] font-mono-num"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] font-semibold hover:bg-[#B94E62] disabled:opacity-50"
            >
              {changingPassword
                ? 'Updating Password & Revoking Old Sessions...'
                : 'Update Password & Invalidate Previous Sessions'}
            </button>
          </form>

          {/* Session Timeout & Hardened Security Controls */}
          <div className="lg:col-span-12 bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F]">
                  Session &amp; Brute-Force Protection
                </span>
                <h3 className="font-serif text-lg font-bold mt-0.5">
                  Inactivity Auto-Logout &amp; Defense Status
                </h3>
              </div>
              <Lock className="w-5 h-5 text-[#3B2824]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-[#FFF8F1] border border-[#E6D7C8] space-y-2 text-xs">
                <label className="block font-bold">
                  Automatic Logout After Inactivity
                </label>
                <select
                  value={inactivityMinutes}
                  onChange={(e) => onChangeInactivityMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6D7C8] bg-white font-semibold"
                >
                  <option value={15}>15 Minutes (High Security Counter Mode)</option>
                  <option value={30}>30 Minutes (Recommended Store Mode)</option>
                  <option value={60}>60 Minutes (Standard Operations)</option>
                  <option value={120}>120 Minutes (Extended Shift)</option>
                </select>
                <p className="text-[11px] text-[#6B544E]">
                  Automatically terminates idle admin sessions when no mouse or keyboard activity is detected.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F5EBE1]/60 border border-[#E6D7C8] space-y-1.5 text-xs">
                <p className="font-bold text-[#3B2824]">Active Password-Only Security Protections</p>
                <ul className="space-y-1 text-[11px] text-[#6B544E]">
                  <li>&bull; Server-side Scrypt key derivation with 16-byte cryptographic salt &amp; timing-safe comparison</li>
                  <li>&bull; Compromised password dictionary blocking &amp; 12-character minimum policy</li>
                  <li>&bull; Progressive delay + 5-minute temporary lockout after 5 failed password attempts</li>
                  <li>&bull; HttpOnly, Secure, SameSite=None, Partitioned session cookie + CSRF header verification</li>
                  <li>&bull; Second-password reauthentication for critical owner-only operations &amp; email updates</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Active Sessions & Device Management */}
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-bold">
                Active Admin &amp; Staff Sessions ({activeSessions.length})
              </h3>
              <p className="text-xs text-[#6B544E]">
                Inspect signed-in browsers/devices and immediately revoke any unrecognized or idle session.
              </p>
            </div>
            {activeSessions.length > 1 && (
              <button
                type="button"
                onClick={() => handleRevokeSession(undefined, true)}
                className="px-3.5 py-2 rounded-xl bg-[#FFF5F5] text-[#B94E62] hover:bg-[#B94E62] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Revoke All Other Devices
              </button>
            )}
          </div>

          {activeSessions.length === 0 ? (
            <p className="text-xs text-[#6B544E] py-4 text-center">
              No active server sessions found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">IP &amp; Browser / Device</th>
                    <th className="py-2 pr-3">Started</th>
                    <th className="py-2 pr-3">Last Active</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {activeSessions.map((sess) => (
                    <tr key={sess.sessionId}>
                      <td className="py-2.5 pr-3">
                        <p className="font-bold text-[#3B2824]">
                          {sess.name}{' '}
                          {sess.isCurrent && (
                            <span className="ml-1 px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2D6A4F] text-[10px]">
                              THIS DEVICE
                            </span>
                          )}
                        </p>
                        <p className="font-mono-num text-[11px] text-[#6B544E]">{sess.email}</p>
                      </td>
                      <td className="py-2.5 pr-3 font-semibold">{sess.roleName}</td>
                      <td className="py-2.5 pr-3 text-[11px] text-[#6B544E] max-w-xs truncate">
                        <span className="font-mono-num font-bold text-[#3B2824]">
                          {sess.ipAddress}
                        </span>{' '}
                        &middot; {sess.userAgent}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#6B544E]">
                        {new Date(sess.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#6B544E]">
                        {new Date(sess.lastActiveAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5">
                        {!sess.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(sess.sessionId, false)}
                            className="px-2.5 py-1 rounded-lg bg-[#FFF5F5] text-[#B94E62] font-bold text-[11px]"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Login History & Suspicious Attempts Monitor */}
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg font-bold">
                Login History &amp; Suspicious Login Attempts ({loginHistory.length})
              </h3>
              <p className="text-xs text-[#6B544E]">
                Tracks successful logins, failed password attempts, brute-force lockouts, password changes, and recovery links.
              </p>
            </div>
            {suspiciousAttempts.length > 0 && (
              <span className="px-3 py-1 rounded-xl bg-[#FFF5F5] text-[#B94E62] text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {suspiciousAttempts.length} Suspicious Event(s) Logged
              </span>
            )}
          </div>

          {loginHistory.length === 0 ? (
            <p className="text-xs text-[#6B544E] py-4 text-center">
              No login events recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2 pr-3">Timestamp</th>
                    <th className="py-2 pr-3">Identifier</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Details</th>
                    <th className="py-2">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {loginHistory.slice(0, 40).map((evt) => (
                    <tr
                      key={evt.id}
                      className={evt.suspicious ? 'bg-[#FFF5F5]/60' : undefined}
                    >
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#6B544E]">
                        {new Date(evt.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num font-bold text-[#3B2824]">
                        {evt.emailOrUsername}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            evt.outcome === 'success' ||
                            evt.outcome === 'password_changed' ||
                            evt.outcome === 'email_changed'
                              ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                              : evt.outcome === 'lockout' || evt.outcome === 'failure'
                              ? 'bg-[#FFF5F5] text-[#B94E62]'
                              : 'bg-[#F5EBE1] text-[#3B2824]'
                          }`}
                        >
                          {evt.outcome.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[#6B544E]">{evt.reason}</td>
                      <td className="py-2.5 font-mono-num text-[11px]">{evt.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Verified Database Backups & Restore Section */}
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-[#3B2824]" />
                Verified Database Snapshots &amp; Point-in-Time JSON Restore
              </h3>
              <p className="text-xs text-[#6B544E]">
                Export a complete SHA-256 checksummed JSON snapshot of all products, categories, custom cakes, orders, payment history, and website CMS configuration.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCreateVerifiedBackup}
                className="px-4 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] hover:bg-[#B94E62] text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export Verified Backup JSON
              </button>
              <label className="px-4 py-2.5 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] hover:bg-[#F5EBE1] text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{restoringBackup ? 'Restoring...' : 'Restore from JSON'}</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleRestoreBackupJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {backupRecords.length > 0 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2 pr-3">Snapshot Date</th>
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2 pr-3">Total Docs</th>
                    <th className="py-2 pr-3">Size</th>
                    <th className="py-2 pr-3">SHA-256 Integrity Checksum</th>
                    <th className="py-2">Exported By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {backupRecords.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-3 font-mono-num text-[11px]">
                        {new Date(b.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3 font-bold">{b.label}</td>
                      <td className="py-2.5 pr-3 font-mono-num">{b.totalDocumentsCount}</td>
                      <td className="py-2.5 pr-3 font-mono-num">
                        {(b.sizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#2D6A4F]">
                        {String(b.checksumSha256 || '').slice(0, 24)}...
                      </td>
                      <td className="py-2.5 font-mono-num text-[11px]">{b.createdByEmail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: IMMUTABLE ACTIVITY & AUDIT LOGS (/admin/activity-logs)
  // ============================================================================
  if (subPath === 'activity-logs') {
    const filteredAudit = auditLogs.filter((l) => {
      if (auditModuleFilter !== 'all' && l.entityType !== auditModuleFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          l.summary.toLowerCase().includes(q) ||
          l.actorEmail.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
              Immutable Administrative Audit Trail
            </span>
            <h2 className="font-serif text-2xl font-bold mt-1">
              Complete Activity &amp; Security Event Ledger ({auditLogs.length})
            </h2>
            <p className="text-xs text-[#6B544E]">
              Every product edit, price update, payment verification, stock adjustment, CMS publish, and security action is permanently recorded.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search actor email, action code, entity ID, or summary..."
              className="px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs"
            />
            <select
              value={auditModuleFilter}
              onChange={(e) => setAuditModuleFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-[#E6D7C8] bg-[#FFF8F1] text-xs font-semibold"
            >
              <option value="all">All BMS Modules</option>
              <option value="orders">Orders &amp; Kitchen</option>
              <option value="payments">Payment Verification</option>
              <option value="products">Products &amp; Catalogue</option>
              <option value="inventory">Inventory &amp; Raw Materials</option>
              <option value="customers">Customer CRM</option>
              <option value="website">Website CMS</option>
              <option value="staff">Staff &amp; RBAC</option>
              <option value="security">Security &amp; Backups</option>
              <option value="settings">Business Settings</option>
            </select>
          </div>

          {filteredAudit.length === 0 ? (
            <p className="text-xs text-[#6B544E] py-8 text-center">
              No audit log entries match the current filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6D7C8] text-[#6B544E]">
                    <th className="py-2.5 pr-3">Timestamp</th>
                    <th className="py-2.5 pr-3">Actor</th>
                    <th className="py-2.5 pr-3">Module</th>
                    <th className="py-2.5 pr-3">Action</th>
                    <th className="py-2.5 pr-3">Entity ID</th>
                    <th className="py-2.5">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7C8]">
                  {filteredAudit.slice(0, 150).map((log) => (
                    <tr key={log.id} className="hover:bg-[#FFF8F1]/60">
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#6B544E] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="font-bold text-[#3B2824]">{log.actorEmail}</p>
                        <p className="text-[10px] text-[#6B544E]">{log.actorRole}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="px-2 py-0.5 rounded bg-[#F5EBE1] text-[#3B2824] font-bold uppercase text-[10px]">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num font-bold text-[#B94E62]">
                        {log.action}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-num text-[11px] text-[#6B544E]">
                        {log.entityId}
                      </td>
                      <td className="py-2.5 text-[#3B2824]">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 4: INTERNAL STAFF HELP & OPERATIONS GUIDE (/admin/help)
  // ============================================================================
  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5">
        <span className="px-2.5 py-1 rounded-lg bg-[#3B2824] text-[#E5B867] text-[10px] font-bold uppercase tracking-wider">
          Internal Staff Operations Manual
        </span>
        <h2 className="font-serif text-2xl font-bold mt-1">
          Lovey&apos;s Bakery &amp; Pizza Corners — BMS Quick Reference Guide
        </h2>
        <p className="text-xs text-[#6B544E]">
          Step-by-step operating procedures for counter staff, kitchen managers, and administrators in Renukoot.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-2.5">
          <h3 className="font-serif text-lg font-bold text-[#3B2824]">
            1. How to Add or Edit Products &amp; Cake Variants
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-[#6B544E]">
            <li>Navigate to <strong>Products (/admin/products)</strong> in the left sidebar.</li>
            <li>Enter the English name, Hindi name, base price, stock quantity, and low-stock alert threshold.</li>
            <li>For Celebration Cakes, specify size variants (e.g. <code>500g (Half Kg):0|1 Kg:400|2 Kg:1150</code>), flavours, and frostings.</li>
            <li>Upload a product photo or select one from the Media Library, then click <strong>Save Product</strong>.</li>
            <li>To bulk upload products, click <strong>Bulk CSV Import</strong> and upload a validated CSV file.</li>
          </ol>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-2.5">
          <h3 className="font-serif text-lg font-bold text-[#3B2824]">
            2. How to Verify Manual UPI Advance Payments
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-[#6B544E]">
            <li>Open <strong>Payment Verification (/admin/payments)</strong> when a new delivery or takeaway order arrives.</li>
            <li>Click <strong>Inspect Proof &amp; Verify</strong> to view the customer&apos;s uploaded UPI screenshot and 12-digit UTR number.</li>
            <li>Confirm the exact advance amount in the store&apos;s PNB / UPI merchant app.</li>
            <li>Click <strong>Verify &amp; Confirm Order</strong> to move the order into kitchen preparation, or <strong>Request Resubmission</strong> if the screenshot is blurry.</li>
          </ol>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-2.5">
          <h3 className="font-serif text-lg font-bold text-[#3B2824]">
            3. How to Manage Daily Orders &amp; Print Invoices
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-[#6B544E]">
            <li>Open <strong>Orders (/admin/orders)</strong> to view live Delivery, Takeaway, and Dine-In Table QR orders.</li>
            <li>Update order status through <em>Confirmed &rarr; Preparing &rarr; Ready for Pickup / Out for Delivery &rarr; Delivered</em>.</li>
            <li>For custom quotation cakes, enter the <strong>Quoted Price (₹)</strong> and click <strong>Send Quote via WhatsApp</strong>.</li>
            <li>Click <strong>Print Invoice / Slip</strong> on any order card to open a clean kitchen preparation slip and customer tax receipt.</li>
          </ol>
        </div>

        <div className="bg-white border border-[#E6D7C8] rounded-2xl p-5 space-y-2.5">
          <h3 className="font-serif text-lg font-bold text-[#3B2824]">
            4. How to Edit Website Content &amp; Manage Staff Passwords
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-[#6B544E]">
            <li>Open <strong>Website CMS (/admin/website)</strong> to edit the homepage hero heading, CTA buttons, promo strip, or section sequence.</li>
            <li>Preview your changes in the live Desktop/Mobile preview pane, then click <strong>Publish to Live Website</strong>.</li>
            <li>In <strong>Staff &amp; Roles (/admin/staff)</strong>, create individual staff accounts with 12+ character passwords, force password resets, or revoke active sessions.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
