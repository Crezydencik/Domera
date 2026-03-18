# Security Changelog

All security-relevant changes to the Domera codebase are recorded here.
Format: `[YYYY-MM-DD] <area>: <summary>`.

---

## 2026-03-18 — Auth hardening & rules automation

### Authentication & Session
- Migrated from raw Firebase ID token in cookie to Firebase session cookies
  (`__session`, HttpOnly, Secure, SameSite=strict).
- Enforced short session TTL (default 30 min, configurable via
  `FIREBASE_SESSION_TTL_MINUTES`).
- Added session invalidation on logout via `revokeRefreshTokens`.
- Switched client hook to `onIdTokenChanged` for automatic token rotation.

### Authorization
- Added apartment ownership check (Firestore lookup) before invoice creation
  in `POST /api/invoices`.
- Added building ownership check before company invitation create/send
  in `POST /api/company-invitations` and `POST /api/company-invitations/send`.
- All new API routes follow deny-by-default; role checks are server-side only.

### Firebase Rules
- Firestore rules updated to tenant-aware model (companyId, apartmentId checks).
- Added `ALIGNMENT NOTE` comment in `firestore.rules` tying each collection
  rule to its corresponding server-side check.
- Created `tests/security/firestore.rules.test.ts` with negative access
  scenarios: cross-tenant read/write, resident write to management collections,
  unauthenticated access.
- Added `firebase.json` with Firestore emulator config.

### Release Gate Automation
- Added `npm run test:rules` — runs emulator + rules unit tests.
- Added `npm run security:secrets` — scans for committed service-account keys.
- Added `npm run security:regression` — static audit of invitation API routes.
- Added `npm run security:release-gate` — full pre-release gate.

### Incident Response
- Created `SECURITY_CONTACTS.md` with contact addresses and response SLA.
- Created `ROLLBACK.md` documenting rollback procedures for rules and auth.

---

<!-- Add new entries above this line, most recent first -->
