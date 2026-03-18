# Rollback Plan — Auth & Firebase Rules Regressions

Use this guide if a security-related change causes an auth outage or broken
access-control in staging or production.

---

## 1. Firebase Rules Rollback

Rules are stored in `src/firebase/rules/firestore.rules` and deployed with
`firebase deploy --only firestore:rules`.

**Steps:**

```bash
# 1. Identify the last known-good commit
git log --oneline src/firebase/rules/firestore.rules

# 2. Check out the previous version locally
git show <GOOD_COMMIT>:src/firebase/rules/firestore.rules > /tmp/firestore.rules.bak

# 3. Deploy the rollback immediately (no full deploy needed)
firebase deploy --only firestore:rules --project <PROJECT_ID>

# 4. Or restore the file and redeploy through CI
git checkout <GOOD_COMMIT> -- src/firebase/rules/firestore.rules
git commit -m "revert: rollback firestore rules to <GOOD_COMMIT>"
git push
```

---

## 2. Session Cookie Auth Rollback

The session cookie flow lives in:
- `src/shared/lib/serverAuth.ts`
- `src/app/api/auth/set-cookies/route.ts`
- `src/app/api/auth/clear-cookies/route.ts`
- `src/shared/hooks/useAuthPersist.ts`

**Steps:**

```bash
# 1. Revert to the last working commit for auth files
git revert <BREAKING_COMMIT> --no-commit

# 2. Verify the revert compiles
npm run typecheck

# 3. Push as a hotfix branch and deploy
git commit -m "revert: rollback session cookie auth changes"
git push origin hotfix/auth-rollback
```

**Emergency:** If users are fully locked out, temporarily loosen
`proxy.ts` to allow all requests while the fix is prepared:
```ts
// EMERGENCY ONLY – revert immediately after incident
const hasSession = true;
```

---

## 3. Firebase Service Account Key Compromise

1. **Immediately revoke** the key in [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Generate a new key and update the secret in your hosting environment.
3. Redeploy the server-side functions/API routes that use the Admin SDK.
4. Audit Firestore/Auth access logs for the compromised period.
5. Document the incident in `CHANGELOG_SECURITY.md`.

---

## 4. Post-Rollback Checklist

- [ ] Verify emulator rule tests pass: `npm run test:rules`
- [ ] Verify secret scan passes: `npm run security:secrets`
- [ ] Verify security regression passes: `npm run security:regression`
- [ ] Run full release gate: `npm run security:release-gate`
- [ ] Notify affected users if data was exposed
- [ ] Write post-mortem entry in `CHANGELOG_SECURITY.md`
