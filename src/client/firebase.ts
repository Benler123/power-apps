import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

/** Auth is optional so the panel still runs locally without a Firebase project. */
export const authConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let cached: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!authConfigured) {
    throw new Error('Firebase is not configured: set VITE_FIREBASE_* in .env');
  }
  if (!cached) {
    cached = getAuth(initializeApp(config));
    void setPersistence(cached, browserLocalPersistence);
  }
  return cached;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(getFirebaseAuth(), provider);
  return credential.user;
}

export function signOutOfGoogle(): Promise<void> {
  return signOut(getFirebaseAuth());
}

export async function idToken(): Promise<string | null> {
  if (!authConfigured) {
    return null;
  }
  return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null;
}
