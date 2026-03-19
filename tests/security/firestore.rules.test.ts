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

const managerBClaims = {
  role: 'ManagementCompany',
  companyId: 'companyB',
};

const accountantAClaims = {
  role: 'Accountant',
  companyId: 'companyA',
};

const residentAClaims = {
  role: 'Resident',
  companyId: 'companyA',
  apartmentId: 'apartmentA',
};

const residentBClaims = {
  role: 'Resident',
  companyId: 'companyB',
  apartmentId: 'apartmentB',
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

    await setDoc(doc(db, 'users', 'accountantA'), {
      uid: 'accountantA',
      role: 'Accountant',
      companyId: 'companyA',
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

    await setDoc(doc(db, 'invoices', 'invoiceB'), {
      companyId: 'companyB',
      apartmentId: 'apartmentB',
      amount: 200,
    });

    await setDoc(doc(db, 'meters', 'meterA'), {
      companyId: 'companyA',
      apartmentId: 'apartmentA',
    });

    await setDoc(doc(db, 'buildings', 'buildingA'), {
      companyId: 'companyA',
      name: 'Building A',
      apartmentIds: ['apartmentA'],
    });

    await setDoc(doc(db, 'news', 'newsA'), {
      companyId: 'companyA',
      title: 'News A',
    });

    await setDoc(doc(db, 'news', 'newsB'), {
      companyId: 'companyB',
      title: 'News B',
    });

    await setDoc(doc(db, 'projects', 'projectA'), {
      companyId: 'companyA',
      title: 'Project A',
    });

    await setDoc(doc(db, 'projects', 'projectB'), {
      companyId: 'companyB',
      title: 'Project B',
    });

    await setDoc(doc(db, 'invitations', 'invitationA'), {
      companyId: 'companyA',
      apartmentId: 'apartmentA',
      email: 'resident@example.com',
      status: 'pending',
    });
  });
};

const testResidentCrossTenantReadDenied = async (env: RulesTestEnvironment) => {
  // residentA belongs to companyA — must NOT read news or projects from companyB
  const residentA = env.authenticatedContext('residentA', residentAClaims).firestore();

  await assertFails(getDoc(doc(residentA, 'news', 'newsB')));
  await assertFails(getDoc(doc(residentA, 'projects', 'projectB')));
  await assertFails(getDoc(doc(residentA, 'invoices', 'invoiceB')));
};

const testResidentOwnTenantReadAllowed = async (env: RulesTestEnvironment) => {
  // residentA must be able to read own company news/projects
  const residentA = env.authenticatedContext('residentA', residentAClaims).firestore();

  const newsSnap = await getDoc(doc(residentA, 'news', 'newsA'));
  if (!newsSnap.exists()) throw new Error('residentA should be able to read own company news');

  const projectSnap = await getDoc(doc(residentA, 'projects', 'projectA'));
  if (!projectSnap.exists()) throw new Error('residentA should be able to read own company projects');
};

const testResidentCrossApartmentDenied = async (env: RulesTestEnvironment) => {
  // residentA (apartmentA) must NOT write to management-only collections
  const residentA = env.authenticatedContext('residentA', residentAClaims).firestore();

  await assertFails(
    setDoc(doc(residentA, 'meters', 'newMeter'), {
      companyId: 'companyA',
      apartmentId: 'apartmentA',
    })
  );
  await assertFails(
    setDoc(doc(residentA, 'buildings', 'buildingX'), {
      companyId: 'companyA',
      name: 'Hacked Building',
    })
  );
};

const testAccountantCrossTenantDenied = async (env: RulesTestEnvironment) => {
  // accountantA belongs to companyA — must NOT access companyB data
  const accountantA = env.authenticatedContext('accountantA', accountantAClaims).firestore();

  await assertFails(getDoc(doc(accountantA, 'companies', 'companyB')));
  await assertFails(getDoc(doc(accountantA, 'apartments', 'apartmentB')));
  await assertFails(getDoc(doc(accountantA, 'invoices', 'invoiceB')));
  await assertFails(
    setDoc(doc(accountantA, 'news', 'newsHacked'), {
      companyId: 'companyB',
      title: 'Hacked',
    })
  );
};

const testUnauthenticatedDeniedForAllCollections = async (env: RulesTestEnvironment) => {
  const unauth = env.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(unauth, 'companies', 'companyA')));
  await assertFails(getDoc(doc(unauth, 'buildings', 'buildingA')));
  await assertFails(getDoc(doc(unauth, 'apartments', 'apartmentA')));
  await assertFails(getDoc(doc(unauth, 'meters', 'meterA')));
  await assertFails(getDoc(doc(unauth, 'invoices', 'invoiceA')));
  await assertFails(getDoc(doc(unauth, 'news', 'newsA')));
  await assertFails(getDoc(doc(unauth, 'projects', 'projectA')));
};

const testResidentCannotReadOtherInvitations = async (env: RulesTestEnvironment) => {
  // residentB must NOT read invitations for apartmentA (different apartment/company)
  const residentB = env.authenticatedContext('residentB', residentBClaims).firestore();
  await assertFails(getDoc(doc(residentB, 'invitations', 'invitationA')));
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

    // Original tests
    await testCrossTenantDenied(env);
    await testResidentWriteDeniedForManagementCollections(env);
    await testUnauthenticatedDenied(env);
    // Extended negative tests
    await testResidentCrossTenantReadDenied(env);
    await testResidentOwnTenantReadAllowed(env);
    await testResidentCrossApartmentDenied(env);
    await testAccountantCrossTenantDenied(env);
    await testUnauthenticatedDeniedForAllCollections(env);
    await testResidentCannotReadOtherInvitations(env);

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
