import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'domera-firestore-rules-test';

const rules = readFileSync(
  join(process.cwd(), 'src', 'firebase', 'rules', 'firestore.rules'),
  'utf8'
);

const managerAClaims = {
  role: 'ManagementCompany',
  companyId: 'companyA',
};

const residentAClaims = {
  role: 'Resident',
  companyId: 'companyA',
  apartmentId: 'apartmentA',
};

const seedData = async (env: RulesTestEnvironment) => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'users', 'managerA'), {
      uid: 'managerA',
      role: 'ManagementCompany',
      companyId: 'companyA',
    });

    await setDoc(doc(db, 'users', 'managerB'), {
      uid: 'managerB',
      role: 'ManagementCompany',
      companyId: 'companyB',
    });

    await setDoc(doc(db, 'users', 'residentA'), {
      uid: 'residentA',
      role: 'Resident',
      companyId: 'companyA',
      apartmentId: 'apartmentA',
    });

    await setDoc(doc(db, 'companies', 'companyA'), {
      userId: 'managerA',
      name: 'Company A',
    });

    await setDoc(doc(db, 'companies', 'companyB'), {
      userId: 'managerB',
      name: 'Company B',
    });

    await setDoc(doc(db, 'apartments', 'apartmentA'), {
      number: '1',
      companyIds: ['companyA'],
      residentId: 'residentA',
      buildingId: 'buildingA',
    });

    await setDoc(doc(db, 'apartments', 'apartmentB'), {
      number: '2',
      companyIds: ['companyB'],
      residentId: 'residentB',
      buildingId: 'buildingB',
    });

    await setDoc(doc(db, 'invoices', 'invoiceA'), {
      companyId: 'companyA',
      apartmentId: 'apartmentA',
      amount: 100,
    });
  });
};

const testCrossTenantDenied = async (env: RulesTestEnvironment) => {
  const managerA = env.authenticatedContext('managerA', managerAClaims).firestore();

  await assertFails(getDoc(doc(managerA, 'apartments', 'apartmentB')));
  await assertFails(
    updateDoc(doc(managerA, 'companies', 'companyB'), {
      name: 'Hacked',
    })
  );
};

const testResidentWriteDeniedForManagementCollections = async (
  env: RulesTestEnvironment
) => {
  const residentA = env.authenticatedContext('residentA', residentAClaims).firestore();

  await assertFails(
    setDoc(doc(residentA, 'invoices', 'residentWriteAttempt'), {
      companyId: 'companyA',
      apartmentId: 'apartmentA',
      amount: 999,
    })
  );

  await assertFails(
    updateDoc(doc(residentA, 'apartments', 'apartmentA'), {
      number: '999',
    })
  );
};

const testUnauthenticatedDenied = async (env: RulesTestEnvironment) => {
  const unauth = env.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(unauth, 'companies', 'companyA')));
  await assertFails(
    setDoc(doc(unauth, 'invitations', 'unauthWriteAttempt'), {
      companyId: 'companyA',
      email: 'test@example.com',
      status: 'pending',
    })
  );
};

const run = async () => {
  let env: RulesTestEnvironment | null = null;

  try {
    env = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules,
      },
    });

    await env.clearFirestore();
    await seedData(env);

    await testCrossTenantDenied(env);
    await testResidentWriteDeniedForManagementCollections(env);
    await testUnauthenticatedDenied(env);

    console.log('✅ Firestore rules negative tests passed');
  } finally {
    await env?.cleanup();
  }
};

run().catch((error) => {
  console.error('❌ Firestore rules negative tests failed');
  console.error(error);
  process.exit(1);
});
