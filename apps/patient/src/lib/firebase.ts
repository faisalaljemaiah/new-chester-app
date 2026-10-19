import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { connectAuthEmulator, getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId) {
  throw new Error('Missing Firebase config. Copy apps/patient/.env.example to .env.local and fill it in.');
}

const isNew = getApps().length === 0;
export const app = isNew ? initializeApp(config) : getApp();

function createAuth(): Auth {
  if (!isNew) return getAuth(app);
  if (Platform.OS === 'web') return getAuth(app);
  // getReactNativePersistence only exists in the React Native build of firebase/auth,
  // so it is missing from the web type definitions.
  const { getReactNativePersistence } = FirebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
  };
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = createAuth();
export const db = getFirestore(app);
export const functions = getFunctions(app, process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? 'me-central2');

if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true' && isNew) {
  const host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}

/** Typed wrappers for the Cloud Functions the patient app calls. */
export const api = {
  registerPatient: httpsCallable<{ displayName: string; phone?: string }, { ok: true }>(functions, 'registerPatient'),
  bookAppointment: httpsCallable<
    { practitionerId: string; date: string; time: string; mode: 'video' | 'audio' | 'chat' },
    { appointmentId: string }
  >(functions, 'bookAppointment'),
  cancelAppointment: httpsCallable<{ appointmentId: string; reason?: string }, { ok: true }>(
    functions,
    'cancelAppointment',
  ),
};
