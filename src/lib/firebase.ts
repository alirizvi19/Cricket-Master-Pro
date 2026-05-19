// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const storage = getStorage(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

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
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let friendlyMessage = error instanceof Error ? error.message : String(error);
  let errorCode = 'unknown';

  if (error && typeof error === 'object' && 'code' in error) {
    errorCode = (error as any).code;
    switch (errorCode) {
      case 'permission-denied':
        friendlyMessage = `Permission denied: You do not have access to ${operationType} this ${path ? 'data at ' + path : 'record'}. Check your authentication status or security rules.`;
        break;
      case 'not-found':
        friendlyMessage = `Not found: The document at ${path || 'target location'} does not exist.`;
        break;
      case 'already-exists':
        friendlyMessage = `Conflict: A document already exists at ${path || 'target location'}.`;
        break;
      case 'resource-exhausted':
        friendlyMessage = 'Quota exceeded: Firebase project limits reached. Please check the Google Cloud Console.';
        break;
      case 'failed-precondition':
        friendlyMessage = 'Operation failed: This might be due to a missing index or other precondition. Check the Firestore console.';
        break;
      case 'unavailable':
        friendlyMessage = 'Service unavailable: The database is temporarily offline or connection was lost.';
        break;
      case 'unauthenticated':
        friendlyMessage = 'Authentication required: Please sign in to perform this action.';
        break;
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: friendlyMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  console.error(`Firestore Error [${errorCode}]: `, JSON.stringify(errInfo));
  // In a real app, you might want to show this message in a toast or alert
  // For now, we continue throwing so the calling component can also handle it if needed
  throw new Error(JSON.stringify(errInfo));
}
