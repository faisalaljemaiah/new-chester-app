import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isNew = getApps().length === 0;
export const app = isNew ? initializeApp(config) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "me-central2");

if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true" && isNew && typeof window !== "undefined") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

/** Typed wrappers for the Cloud Functions the dashboard calls. */
export const api = {
  respondToTransfer: httpsCallable<{ transferId: string; accept: boolean }, { ok: true }>(functions, "respondToTransfer"),
  reviewAvailabilityRequest: httpsCallable<
    { requestId: string; approve: boolean },
    { ok: true; affectedAppointments: number }
  >(functions, "reviewAvailabilityRequest"),
  cancelAppointment: httpsCallable<{ appointmentId: string; reason?: string }, { ok: true }>(
    functions,
    "cancelAppointment",
  ),
  createPractitioner: httpsCallable<
    { email: string; displayName: string; title: string; discipline: string; timeZone?: string; admin?: boolean },
    { uid: string; setPasswordLink: string }
  >(functions, "createPractitioner"),
};
