// Gives an existing account the admin role (one-time bootstrap for the clinic owner).
// Usage: GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json npm run make-admin -- owner@example.com
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}

initializeApp();
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: "admin" });
await getFirestore()
  .doc(`users/${user.uid}`)
  .set(
    { role: "admin", email, displayName: user.displayName ?? email, locale: "en", createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
console.log(`${email} is now an admin. They need to sign out and back in.`);
