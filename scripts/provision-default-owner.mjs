#!/usr/bin/env node
/**
 * Server-Side Owner Account Provisioning & Reconciliation Procedure
 * Lovey's Bakery & Pizza Corners — Enterprise BMS
 *
 * Security Rules:
 * - Reads the initial temporary password strictly from process.env.INITIAL_OWNER_TEMP_PASSWORD
 *   (or uses the pre-computed irreversible Scrypt hash if env var is omitted).
 * - Never hardcodes plaintext credentials in source files or Git history.
 * - Never exposes Firebase Admin SDK service-account credentials to the frontend.
 * - Checks Firebase Authentication (Email/Password) and reconciles the Owner / Super Admin
 *   profile without creating duplicate accounts.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const OWNER_EMAIL = 'owner@loveys-demo.test';
const OWNER_USERNAME = 'owner';
const OWNER_ID = 'staff-owner-default';
const OWNER_NAME = "Lovey's Principal Owner";
const OWNER_ROLE_ID = 'role-owner';
const OWNER_ROLE_NAME = 'Owner / Super Admin';
const OWNER_PERMISSIONS =
  'view,create,edit,publish,delete_archive,export_csv,approve_orders,verify_payments,manage_settings,invite_staff';

// Pre-computed irreversible Scrypt hash (N=16384, r=8, p=1, keylen=64)
const DEFAULT_OWNER_INITIAL_SCRYPT_HASH =
  'scrypt$4c6f766579734f776e657253616c7432303236$272406fa7f1f95fb413f432b6fbc89bb16af5394073c361a39ba06068ac949a76e953d4198e8cd1343f9bfc6d3a6e732e241edca6b5e5bccbcc3ff747c8d0074';

function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

async function attemptFirebaseAuthAndFirestoreProvisioning(tempPassword) {
  const configPath = path.join(ROOT_DIR, 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    return {
      firebaseAuthStatus: 'SKIPPED_NO_CONFIG',
      detail: 'firebase-applet-config.json not found.',
    };
  }

  const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const apiKey = fbConfig.apiKey;
  const projectId = fbConfig.projectId;
  const databaseId = fbConfig.firestoreDatabaseId || '(default)';

  if (!tempPassword) {
    return {
      firebaseAuthStatus: 'SKIPPED_NO_ENV_PASSWORD',
      detail:
        'INITIAL_OWNER_TEMP_PASSWORD was not passed in environment; used pre-computed Scrypt hash for server store.',
    };
  }

  // 1. Check if account already exists in Firebase Auth via signInWithPassword
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
    apiKey
  )}`;
  let idToken = null;
  let localId = null;
  let authAction = '';

  const signInRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: OWNER_EMAIL,
      password: tempPassword,
      returnSecureToken: true,
    }),
  });
  const signInData = await signInRes.json();

  if (signInRes.ok && signInData.idToken) {
    idToken = signInData.idToken;
    localId = signInData.localId;
    authAction = 'RECONCILED_EXISTING_FIREBASE_AUTH_USER';
  } else {
    const errMsg = signInData?.error?.message || 'UNKNOWN_ERROR';
    // If user does not exist yet, attempt signUp
    if (
      errMsg === 'EMAIL_NOT_FOUND' ||
      errMsg === 'INVALID_LOGIN_CREDENTIALS' ||
      errMsg.startsWith('USER_NOT_FOUND')
    ) {
      const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
        apiKey
      )}`;
      const signUpRes = await fetch(signUpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: OWNER_EMAIL,
          password: tempPassword,
          displayName: OWNER_NAME,
          returnSecureToken: true,
        }),
      });
      const signUpData = await signUpRes.json();
      if (signUpRes.ok && signUpData.idToken) {
        idToken = signUpData.idToken;
        localId = signUpData.localId;
        authAction = 'CREATED_NEW_FIREBASE_AUTH_USER';
      } else {
        return {
          firebaseAuthStatus: 'FIREBASE_AUTH_REJECTED',
          errorCode: signUpData?.error?.message || errMsg,
          detail:
            'Firebase Authentication rejected Email/Password creation (e.g., OPERATION_NOT_ALLOWED when Email/Password provider is not enabled in Firebase Console, or EMAIL_EXISTS with a different password).',
        };
      }
    } else {
      return {
        firebaseAuthStatus: 'FIREBASE_AUTH_REJECTED',
        errorCode: errMsg,
        detail:
          'Firebase Authentication rejected Email/Password sign-in (e.g., OPERATION_NOT_ALLOWED when Email/Password sign-in provider is disabled in Firebase Console).',
      };
    }
  }

  // 2. If Firebase Auth returned an idToken, reconcile Firestore staff_members profile
  if (idToken) {
    const nowIso = new Date().toISOString();
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/staff_members/${encodeURIComponent(
      OWNER_ID
    )}`;
    const firestoreRes = await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          id: { stringValue: OWNER_ID },
          email: { stringValue: OWNER_EMAIL },
          username: { stringValue: OWNER_USERNAME },
          name: { stringValue: OWNER_NAME },
          phone: { stringValue: '+91 80905 29971' },
          roleId: { stringValue: OWNER_ROLE_ID },
          roleName: { stringValue: OWNER_ROLE_NAME },
          permissionsSummary: { stringValue: OWNER_PERMISSIONS },
          status: { stringValue: 'active' },
          requirePasswordChange: { booleanValue: true },
          mustChangePassword: { booleanValue: true },
          sessionVersion: { integerValue: '1' },
          sessionTimeoutMinutes: { integerValue: '60' },
          passwordUpdatedAt: { stringValue: nowIso },
          invitedByEmail: { stringValue: 'system' },
          createdAt: { stringValue: nowIso },
          updatedAt: { stringValue: nowIso },
        },
      }),
    });
    const fsStatus = firestoreRes.status;
    return {
      firebaseAuthStatus: authAction,
      uid: localId,
      firestoreSyncHttpStatus: fsStatus,
    };
  }

  return { firebaseAuthStatus: 'UNKNOWN' };
}

function reconcileServerAuthStore(tempPassword) {
  const storeDir = path.join(ROOT_DIR, '.data');
  const storeFile = path.join(storeDir, 'admin-auth-store.json');
  const nowIso = new Date().toISOString();
  const passwordHash =
    tempPassword && tempPassword.trim().length >= 12
      ? hashPasswordScrypt(tempPassword.trim())
      : DEFAULT_OWNER_INITIAL_SCRYPT_HASH;

  let store = {
    ownerConfigured: true,
    accounts: [],
    sessions: [],
    loginHistory: [],
    resetTokens: [],
  };

  if (fs.existsSync(storeFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
      if (parsed && Array.isArray(parsed.accounts)) {
        store = parsed;
      }
    } catch {
      // use fresh store structure
    }
  }

  // Reconcile without creating duplicates
  let ownerAcc = store.accounts.find(
    (a) =>
      a.email?.toLowerCase() === OWNER_EMAIL ||
      a.roleId === OWNER_ROLE_ID
  );

  let action = 'UPDATED_EXISTING_OWNER_PROFILE';
  if (!ownerAcc) {
    action = 'CREATED_DEFAULT_OWNER_PROFILE';
    ownerAcc = {
      id: OWNER_ID,
      email: OWNER_EMAIL,
      username: OWNER_USERNAME,
      name: OWNER_NAME,
      phone: '+91 80905 29971',
      roleId: OWNER_ROLE_ID,
      roleName: OWNER_ROLE_NAME,
      permissionsSummary: OWNER_PERMISSIONS,
      status: 'active',
      passwordHash,
      requirePasswordChange: true,
      mustChangePassword: true,
      sessionVersion: 1,
      sessionTimeoutMinutes: 60,
      passwordUpdatedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.accounts.unshift(ownerAcc);
  } else {
    ownerAcc.id = OWNER_ID;
    ownerAcc.email = OWNER_EMAIL;
    ownerAcc.username = OWNER_USERNAME;
    ownerAcc.name = OWNER_NAME;
    ownerAcc.roleId = OWNER_ROLE_ID;
    ownerAcc.roleName = OWNER_ROLE_NAME;
    ownerAcc.permissionsSummary = OWNER_PERMISSIONS;
    ownerAcc.status = 'active';
    ownerAcc.passwordHash = passwordHash;
    ownerAcc.requirePasswordChange = true;
    ownerAcc.mustChangePassword = true;
    ownerAcc.updatedAt = nowIso;
  }

  store.ownerConfigured = true;
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf8');

  return {
    serverStoreAction: action,
    email: ownerAcc.email,
    username: ownerAcc.username,
    roleId: ownerAcc.roleId,
    roleName: ownerAcc.roleName,
    mustChangePassword: ownerAcc.mustChangePassword,
    requirePasswordChange: ownerAcc.requirePasswordChange,
    totalOwnerAccounts: store.accounts.filter((a) => a.roleId === OWNER_ROLE_ID).length,
  };
}

async function main() {
  const tempPassword = process.env.INITIAL_OWNER_TEMP_PASSWORD || '';
  const serverResult = reconcileServerAuthStore(tempPassword);
  const firebaseResult = await attemptFirebaseAuthAndFirestoreProvisioning(tempPassword);

  console.log(
    JSON.stringify(
      {
        provisionedAt: new Date().toISOString(),
        serverAuthStore: serverResult,
        firebaseAuthAndFirestore: firebaseResult,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('Provisioning error:', err);
  process.exit(1);
});
