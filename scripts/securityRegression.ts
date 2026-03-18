import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Check = {
  description: string;
  pattern: RegExp;
};

type Target = {
  file: string;
  checks: Check[];
};

const targets: Target[] = [
  {
    file: 'src/app/api/invitations/send/route.ts',
    checks: [
      { description: 'requires authenticated request', pattern: /requireRequestAuth\(/ },
      { description: 'applies rate limiting', pattern: /consumeRateLimit\(/ },
      { description: 'writes audit events', pattern: /writeAuditEvent\(/ },
      { description: 'checks tenant mismatch', pattern: /tenant_mismatch|Access denied for company/ },
    ],
  },
  {
    file: 'src/app/api/invitations/resolve/route.ts',
    checks: [
      { description: 'applies rate limiting', pattern: /consumeRateLimit\(/ },
      { description: 'uses token hash lookup', pattern: /tokenHash|hashInvitationToken/ },
      { description: 'writes audit events', pattern: /writeAuditEvent\(/ },
    ],
  },
  {
    file: 'src/app/api/invitations/accept/route.ts',
    checks: [
      { description: 'applies rate limiting', pattern: /consumeRateLimit\(/ },
      { description: 'enforces one-time acceptance state', pattern: /invitation_already_accepted|status.*pending/ },
      { description: 'writes audit events', pattern: /writeAuditEvent\(/ },
    ],
  },
  {
    file: 'src/app/api/company-invitations/send/route.ts',
    checks: [
      { description: 'requires authenticated request', pattern: /requireRequestAuth\(/ },
      { description: 'applies rate limiting', pattern: /consumeRateLimit\(/ },
      { description: 'validates building/company ownership', pattern: /building_company_mismatch|Access denied for building\/company ownership/ },
      { description: 'writes audit events', pattern: /writeAuditEvent\(/ },
    ],
  },
  {
    file: 'src/app/api/company-invitations/route.ts',
    checks: [
      { description: 'requires authenticated request', pattern: /requireRequestAuth\(/ },
      { description: 'validates building/company ownership', pattern: /buildingCompanyId|Access denied for building\/company ownership/ },
    ],
  },
  {
    file: 'src/app/api/company-invitations/accept/route.ts',
    checks: [
      { description: 'requires authenticated request', pattern: /requireRequestAuth\(/ },
      { description: 'verifies invitation email ownership', pattern: /email_mismatch|cannot accept this invitation/ },
      { description: 'writes audit events', pattern: /writeAuditEvent\(/ },
    ],
  },
];

const failures: string[] = [];

for (const target of targets) {
  const absolute = join(process.cwd(), target.file);

  if (!existsSync(absolute)) {
    failures.push(`${target.file}: file not found`);
    continue;
  }

  const content = readFileSync(absolute, 'utf8');

  for (const check of target.checks) {
    if (!check.pattern.test(content)) {
      failures.push(`${target.file}: missing check \"${check.description}\"`);
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Focused invitation security regression FAILED');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('✅ Focused invitation security regression PASSED');
