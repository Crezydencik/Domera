# Rules ↔ Server Checks Alignment

When schema or authorization logic changes, update **both**:

1. `src/firebase/rules/firestore.rules`
2. Server API ownership checks in `src/app/api/**/route.ts`

## Required Verification Steps

Run before merging:

- `npm run test:rules`
- `npm run security:regression`

## Change Checklist

- [ ] New/changed collection fields documented (`companyId`, `companyIds`, `apartmentId`, role claims)
- [ ] Firestore rules updated for new read/write paths
- [ ] Server-side ownership checks updated in affected API routes
- [ ] New negative test case added to `tests/security/firestore.rules.test.ts`
- [ ] Invitation/company-invitation regression checks still pass
