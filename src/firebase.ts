import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const ADMIN_GOOGLE_EMAIL = 'hridoyrifat754@gmail.com';
export const BUILDING_DOC_ID = 'alam-khan-building';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db: Firestore = createFirestoreInstance();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ConnectionTestResult {
  connected: boolean;
  offline?: boolean;
  quotaExceeded?: boolean;
  error?: string;
}

export async function testFirestoreConnection(): Promise<ConnectionTestResult> {
  try {
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore connection probe timed out')), 4000)
      ),
    ]);
    return { connected: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('the client is offline') ||
      message.includes('unavailable') ||
      message.includes('timed out')
    ) {
      console.warn('Firestore client is offline or slow.');
      return { connected: false, offline: true, error: message };
    }
    if (message.includes('Quota exceeded')) {
      return { connected: false, quotaExceeded: true, error: message };
    }
    // Missing/insufficient permissions on test/connection proves Firestore responded online!
    if (
      message.toLowerCase().includes('permission') ||
      message.toLowerCase().includes('insufficient')
    ) {
      return { connected: true };
    }
    return { connected: false, error: message };
  }
}

export { firebaseConfig };
