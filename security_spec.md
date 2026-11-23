# Phase 0: Payload-First Security TDD Specification (`security_spec.md`)

## 1. Data Invariants
1. **Global Default Deny**: Any path not explicitly matched is denied for all reads and writes.
2. **Admin Role Integrity**: Only authenticated users with a verified email matching the bootstrapped owner email (`prabhve5@gmail.com`) or an existing `/admins/{uid}` document can write to `/business_settings`, `/categories`, `/products`, `/cake_designs`, `/media_assets`, `/coupons`, `/delivery_zones`, or `/dining_tables`.
3. **PII Isolation on Orders**: `/orders/{orderId}` contains customer PII (`customerName`, `customerPhone`, `customerEmail`, `deliveryAddress`). Read and list access on `/orders/{orderId}` is strictly limited to `isAdmin()` or `resource.data.userId == request.auth.uid`. Non-PII order status lookups use `/order_summaries/{orderNumber}` via `get`.
4. **Strict Key & Size Enforcement**: Every write (`create` and `update`) calls a dedicated `isValid[Entity](incoming())` helper enforcing `keys().hasAll(...)`, `keys().hasOnly(...)`, string `.size()` boundaries, numeric range bounds, and regex ID validation (`isValidId`).
5. **Temporal & Identity Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`. On `orders` creation, `incoming().userId == request.auth.uid` and `incoming().createdAt == request.time`. On update, `userId`, `orderNumber`, and `createdAt` are immutable.
6. **Terminal State Locking**: Once an order reaches `"Completed"` or `"Cancelled"`, non-admin users cannot mutate it.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection**: Creating a product or order with an extra undeclared field `{"isVerifiedAdmin": true}` -> Rejected by `keys().hasOnly(...)`.
2. **Unverified Admin Email Spoof**: User with `email == "prabhve5@gmail.com"` but `email_verified == false` attempting to update `/business_settings/main` -> Rejected by `request.auth.token.email_verified == true`.
3. **Cross-User Order Creation (Identity Spoofing)**: Authenticated user `uid_A` creating `/orders/ORD-1` with `userId: "uid_B"` -> Rejected by `incoming().userId == request.auth.uid`.
4. **PII Blanket Read on Orders**: Authenticated user `uid_A` attempting `get` or `list` on `/orders/ORD-2` belonging to `uid_B` -> Rejected by `resource.data.userId == request.auth.uid || isAdmin()`.
5. **ID Poisoning Attack**: Creating a document with a 500-character or special-character document ID -> Rejected by `isValidId(id)`.
6. **Denial-of-Wallet String Overflow**: Submitting a 50KB `orderNotes` string in `/orders/{orderId}` -> Rejected by `data.orderNotes.size() <= 500`.
7. **Timestamp Forgery on Create**: Creating `/orders/{orderId}` with a backdated `createdAt` timestamp != `request.time` -> Rejected by `incoming().createdAt == request.time`.
8. **Immortal Field Mutation on Update**: Updating `createdAt` or `userId` on an existing `/orders/{orderId}` document -> Rejected by `incoming().createdAt == existing().createdAt && incoming().userId == existing().userId`.
9. **Terminal State Bypass**: Customer attempting to update an order whose `existing().status == "Completed"` -> Rejected by terminal state guard.
10. **Negative Price / Total Manipulation**: Customer creating an order with `totalAmount: -500` or `subtotal: -10` -> Rejected by numeric boundary checks (`>= 0`).
11. **Privilege Escalation via `/admins` Self-Registration**: Regular authenticated user attempting to create `/admins/{theirUid}` -> Rejected because only bootstrapped admin can create `/admins/{adminId}`.
12. **Value Poisoning on Update**: Customer updating `/orders/{orderId}` with `status: 12345` (number instead of allowed enum string) -> Rejected because `isValidOrder(incoming())` wraps the entire `allow update` block.
