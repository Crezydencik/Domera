# Security Policy & Hardening Checklist

## Scope

This checklist applies to the Domera codebase and Firebase-backed production deployments.

## Immediate Controls (must-have)

- [x] Server-side token verification for sensitive APIs (`verifyIdToken`).
- [x] Role and tenant ownership checks (`companyId`, `apartmentId`) on server.
- [x] Firestore rules switched from permissive dev mode to tenant-aware rules.
- [x] Invitation token storage migrated to hash-first model (`tokenHash`).
- [x] Rate limiting added to invitation resolve/accept endpoints.

## Authentication & Session

- [x] Move from raw ID token cookie usage to Firebase session cookies (HttpOnly, Secure, SameSite=strict).
- [x] Rotate session cookies and enforce short session TTL.
- [x] Invalidate sessions on critical account changes.

## Authorization

- [x] Enforce `deny-by-default` pattern for all new API routes.
- [x] Keep role checks server-side only; client checks are UX-only.
- [x] Validate all resource ownership (`companyId/apartmentId`) before reads/writes.

## Invitations

- [x] Store only `tokenHash`; use raw `token` fallback only for legacy records.
- [x] Add one-time token usage guarantees in invitation resolve/accept flow.
- [x] Run legacy token cleanup migration:
  - [x] Dry run: `npm run migrate:invitationTokens`
  - [x] Apply: `npm run migrate:invitationTokens -- --apply`
- [x] Remove legacy raw-token fallback after migration window ends.
- [x] Add invitation expiration cleanup job.
  - [x] Dry run: `npm run cleanup:invitations`
  - [x] Apply revoke expired pending: `npm run cleanup:invitations -- --apply`
  - [x] Apply purge retained docs: `npm run cleanup:invitations -- --apply --purge-retained`
- [x] Schedule periodic execution of invitation cleanup job (cron/CI/Cloud Scheduler).

## Logging & Privacy

- [x] Remove token and sensitive invitation debug logs.
- [x] Redact PII in logs (email, uid, token fragments).
  - [x] Auth/login flows switched to sanitized logging (`toSafeErrorDetails`), removed direct `email/uid` debug prints.
  - [x] Cleaned noisy object/debug logging in apartments management dashboard flow.
  - [x] Swept `invitationsService`, `notificationsService`, `projectsService` — raw error objects replaced with `toSafeErrorDetails`. Removed stray debug `console.log` in notificationsService.
- [x] Keep audit events for invitation and admin onboarding flows (send/resolve/accept, company invitations, apartments import).
- [x] Extend audit events to invoice and meter-reading critical mutation operations.
- [x] Extend audit events to document/file mutation operations.

## Firebase Rules

- [x] Add Firebase Emulator tests for negative access scenarios:
  - [x] cross-tenant read/write denied (manager A vs company B)
  - [x] resident write to management-only collections denied
  - [x] unauthenticated access denied for all collections (companies, buildings, apartments, meters, invoices, news, projects)
  - [x] resident cross-tenant read of news/projects denied
  - [x] accountant cross-tenant denial
  - [x] resident cannot read another apartment's invitations
- [x] Resident read on `news` and `projects` scoped to own company (cross-tenant read gap fixed).
- [x] Keep rules and server checks aligned whenever schema changes.

## Abuse Protection

- [x] Per-IP + per-token hash rate limits for invitation endpoints.
- [x] Add rate limits for invitation send and invoice/meter mutation endpoints.
- [x] Add rate limits for auth endpoints.
- [x] Add alerting for repeated 401/403/429 bursts.

- [x] Rate limits on `company-invitations` list (GET) and accept (POST) — previously missing.
- [x] All 429 responses include `Retry-After` header.
- [x] Rate limiter migrated from in-process `Map` to Firestore-backed distributed store.
  - **OPERATIONAL**: configure Firestore TTL policy — Collection: `rate_limits`, Field: `expiresAt`.
- [x] Invite acceptance (both new-user and authenticated-user flows) wrapped in Firestore transaction
      to prevent TOCTOU double-acceptance.

## Release Gate

Before production release:

- [x] Run lint/typecheck/build and resolve critical issues.
- [x] Verify Firebase rules in staging and production projects.
- [x] Confirm no secrets or service-account keys are committed.
- [x] Run a focused security regression pass on `/api/invitations/*` and `/api/company-invitations/*`.

### Pre-go-live operational tasks

- [ ] Run invitation token migration: `npm run migrate:invitationTokens -- --apply`
- [ ] Schedule `npm run cleanup:invitations -- --apply` via Cloud Scheduler or CI cron (recommended: daily).
- [ ] Configure Firestore TTL policy on `rate_limits` collection, field `expiresAt`.
- [ ] Run emulator rules tests: `npx ts-node tests/security/firestore.rules.test.ts` (requires Firebase emulator).
- [ ] Deploy updated Firestore rules to production: `firebase deploy --only firestore:rules`.

### CI/CD automation configured

- [x] Scheduled cleanup workflow: `.github/workflows/cleanup-invitations.yml`
  - Daily run at `02:00 UTC`
  - Manual run with optional `purge_retained` flag
- [x] Manual security operations workflow: `.github/workflows/security-ops.yml`
  - `invitation_tokens_migration_dry_run`
  - `invitation_tokens_migration_apply`
  - `firestore_rules_tests`
  - `security_release_gate`
  - `deploy_firestore_rules`
- [ ] Required GitHub secrets in repo/environment:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `FIREBASE_TOKEN` (required for `deploy_firestore_rules`)

## Incident Response

- [x] Define security contact and response SLA.
- [x] Document rollback plan for auth/rules regressions.
- [x] Keep a changelog of security-relevant changes.
