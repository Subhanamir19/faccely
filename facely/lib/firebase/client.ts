import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

const ENV_TO_OPTION_MAP = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
} as const;

type FirebaseEnvOption = keyof typeof ENV_TO_OPTION_MAP;

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;

/**
 * Returns the shared Firebase app instance, initializing it only once.
 */
export const getFirebaseApp = (): FirebaseApp => {
  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  return firebaseApp;
};

/**
 * Returns the shared Firebase Auth instance scoped to the singleton app.
 */
export const getFirebaseAuth = (): Auth => {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  firebaseAuth = getAuth(getFirebaseApp());
  return firebaseAuth;
};

const getFirebaseConfig = (): FirebaseOptions => {
  const resolved = resolveFirebaseEnv();
  return {
    apiKey: resolved.apiKey,
    authDomain: resolved.authDomain,
    projectId: resolved.projectId,
    storageBucket: resolved.storageBucket,
    messagingSenderId: resolved.messagingSenderId,
    appId: resolved.appId,
  };
};

const resolveFirebaseEnv = (): Record<FirebaseEnvOption, string> => {
  const missing: string[] = [];
  const resolved = {} as Record<FirebaseEnvOption, string>;

  (Object.entries(ENV_TO_OPTION_MAP) as Array<[FirebaseEnvOption, string]>).forEach(([optionKey, envKey]) => {
    const rawValue = process.env[envKey];
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      missing.push(envKey);
      return;
    }

    resolved[optionKey] = rawValue;
  });

  if (missing.length > 0) {
    throw new Error(`Firebase is misconfigured. Set the following Expo env vars: ${missing.join(', ')}`);
  }

  return resolved;
};
