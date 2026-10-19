// Loads the standard assessment forms (PHQ-9, GAD-7) and a few starter message templates.
// Safe to run more than once. Point it at the emulator with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.
import { SEED_FORMS } from "@chester/shared";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID });
const db = getFirestore();

const templates = [
  {
    id: "welcome-en",
    kind: "message",
    locale: "en",
    title: "Welcome",
    body: "Welcome to New Chester Clinic. I'm looking forward to our first session. If anything comes up before then, message me here.",
  },
  {
    id: "reminder-en",
    kind: "message",
    locale: "en",
    title: "Session reminder",
    body: "A reminder that our session is coming up. Please find a quiet, private place and join from the app a few minutes early.",
  },
  {
    id: "phq9-en",
    kind: "assessment",
    locale: "en",
    formId: "phq9",
    title: "PHQ-9 check-in",
    body: "Please fill in this short questionnaire before our next session. It takes about 3 minutes.",
  },
  {
    id: "gad7-en",
    kind: "assessment",
    locale: "en",
    formId: "gad7",
    title: "GAD-7 check-in",
    body: "Please fill in this short questionnaire about anxiety before our next session.",
  },
];

const batch = db.batch();
for (const [id, form] of Object.entries(SEED_FORMS)) batch.set(db.doc(`assessmentForms/${id}`), form);
for (const { id, ...t } of templates) {
  batch.set(db.doc(`templates/${id}`), { ...t, ownerId: "clinic", shared: true, createdAt: FieldValue.serverTimestamp() });
}
await batch.commit();
console.log(`Seeded ${Object.keys(SEED_FORMS).length} forms and ${templates.length} templates.`);
