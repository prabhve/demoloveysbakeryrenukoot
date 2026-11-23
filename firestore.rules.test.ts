/**
 * Phase 0: Payload-First Security TDD Test Suite for firestore.rules
 * Verifies that all Dirty Dozen attack payloads are denied by the ruleset.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Order Create',
    collection: '/orders/ORD-1001',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { ghostAdminFlag: true },
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof on Business Settings',
    collection: '/business_settings/main',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Order Create (Mismatched userId)',
    collection: '/orders/ORD-1002',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { userId: 'spoofed_other_uid' },
  },
  {
    id: 4,
    name: 'Cross-User PII Read on Orders Collection',
    collection: '/orders/ORD-1003',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning with Special Characters',
    collection: '/orders/INVALID$ID#123',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Denial-of-Wallet Oversized String in orderNotes',
    collection: '/orders/ORD-1004',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { orderNotes: 'A'.repeat(5000) },
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Order Create',
    collection: '/orders/ORD-1005',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field (createdAt / userId) Mutation on Update',
    collection: '/orders/ORD-1006',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal State Bypass (Updating Completed Order as Non-Admin)',
    collection: '/orders/ORD-1007',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Negative Total Amount Manipulation on Order Create',
    collection: '/orders/ORD-1008',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { totalAmount: -100 },
  },
  {
    id: 11,
    name: 'Self-Assigned Admin Role Escalation',
    collection: '/admins/attacker_uid',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Value Poisoning on Whitelisted Update Key',
    collection: '/orders/ORD-1009',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { status: 99999 },
  },
];
