import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const candidateSecretFiles = [
  'src/firebase/firebase-service-account.json',
  'firebase-service-account.json',
];

const forbiddenPatterns = [
  /-----BEGIN PRIVATE KEY-----/,
  /"type"\s*:\s*"service_account"/,
  /"private_key"\s*:/,
];

const failures: string[] = [];

for (const relPath of candidateSecretFiles) {
  const filePath = join(process.cwd(), relPath);
  if (!existsSync(filePath)) continue;

  const content = readFileSync(filePath, 'utf8');
  if (forbiddenPatterns.some((pattern) => pattern.test(content))) {
    failures.push(`Sensitive service account file detected: ${relPath}`);
  }
}

if (failures.length > 0) {
  console.error('❌ Secret scan failed');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  console.error('Rotate leaked keys immediately and use env-based secrets only.');
  process.exit(1);
}

console.log('✅ Secret scan passed (no committed service-account secrets detected)');
