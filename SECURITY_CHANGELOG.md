# Security Changelog

## 2026-03-18

### Authentication & Session
- Migrated from raw ID token cookies to Firebase session cookie (`__session`).
- Enforced short session TTL via `FIREBASE_SESSION_TTL_MINUTES`.
- Added revocation-aware verification and logout-driven session invalidation.

### Authorization
- Added stricter ownership checks for invoices and company-invitations endpoints.
- Strengthened route guard logic to use session-cookie presence.

### Rules & Regression
- Added Firestore Emulator negative tests for:
  - cross-tenant read/write denial
  - resident write denial to management-only collections
  - unauthenticated access denial
- Added focused invitation security regression script.

### Secret Hygiene
- Removed committed Firebase service-account key from repository.
- Added explicit secret scanning script for service-account artifacts.
- Added `.env.example` and updated `.gitignore` for secret-safe defaults.
