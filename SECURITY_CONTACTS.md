# Security Contacts & Response SLA

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Contact the security team privately:

| Role | Contact |
|------|---------|
| Primary security contact | security@lumtach.com |
| Backup / escalation | admin@lumtach.com |

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Affected component (API route, Firestore rule, auth flow, etc.)
- Potential impact assessment

## Response SLA

| Severity | Initial acknowledgement | Patch target |
|----------|------------------------|--------------|
| Critical (auth bypass, data exfil) | 4 hours | 24 hours |
| High (privilege escalation, tenant leak) | 8 hours | 72 hours |
| Medium (rate-limit bypass, info disclosure) | 24 hours | 1 week |
| Low (hardening improvement) | 48 hours | next sprint |

## Out-of-Scope

- Denial of service against Firebase infrastructure (report to Google)
- Issues in third-party dependencies with no available patch
