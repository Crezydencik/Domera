# Security Incident Response Plan

## Security Contact & SLA

- **Primary contact:** `security@domera.local` (replace with production mailbox)
- **Backup contact:** platform on-call engineer
- **Triage SLA:** within **30 minutes** for Critical/High, **4 hours** for Medium
- **Customer update SLA:** first external update within **2 hours** for Critical incidents

## Severity Levels

- **Critical:** auth bypass, cross-tenant data exposure, leaked production credentials
- **High:** privilege escalation limited to one tenant, persistent unauthorized writes
- **Medium:** abuse spikes, repeated 401/403/429 anomalies, non-exploited misconfigurations
- **Low:** hardening gaps without active exploit path

## Auth/Rules Rollback Plan

1. **Freeze deployments** and announce incident channel.
2. **Revert app auth changes** to last known-good commit for:
   - `src/shared/lib/serverAuth.ts`
   - `src/app/api/auth/*`
   - `proxy.ts`
3. **Restore known-good Firestore rules**:
   - Deploy previous rules file version from Git history.
4. **Revoke active sessions**:
   - Run admin revocation (`revokeRefreshTokens`) for impacted users/tenants.
5. **Validate rollback**:
   - Re-run focused security regression (`npm run security:regression`).
   - Re-run Firestore rules tests (`npm run test:rules`).
6. **Post-incident actions**:
   - Add missing tests/checks.
   - Record final timeline and root cause in `SECURITY_CHANGELOG.md`.

## Evidence Collection

Capture and preserve:
- request IDs / trace IDs
- audit events (`invitation.*`, `company_invitation.*`, auth events)
- relevant git commit hashes and deployment timestamps
- impacted tenant/resource identifiers (redacted for external reports)
