// Security rules tests. Run with `npm run test:rules` (starts the Firestore emulator).
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";

let env: RulesTestEnvironment;

const PATIENT = "patient1";
const OTHER_PATIENT = "patient2";
const DR = "dr1"; // on patient1's care team
const DR_OTHER = "dr2"; // not on the care team
const ADMIN = "admin1";

const as = (uid: string, role: string) => env.authenticatedContext(uid, { role }).firestore();
const patient = () => as(PATIENT, "patient");
const dr = () => as(DR, "practitioner");
const drOther = () => as(DR_OTHER, "practitioner");
const admin = () => as(ADMIN, "admin");

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-chester",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", PATIENT), { role: "patient", displayName: "Pat", email: "p@x.com", locale: "en" });
    await setDoc(doc(db, "patients", PATIENT), {
      displayName: "Pat",
      email: "p@x.com",
      primaryPractitionerId: DR,
      careTeam: [DR],
      status: "active",
      completedSessions: 0,
    });
    await setDoc(doc(db, "patients", OTHER_PATIENT), { displayName: "Other", careTeam: [DR_OTHER], status: "active" });
    await setDoc(doc(db, "patients", PATIENT, "notes", "n1"), { authorId: DR, body: "private", createdAt: new Date() });
    await setDoc(doc(db, "practitioners", DR), { displayName: "Dr One", active: true, weeklyHours: {}, blockedRanges: [] });
    await setDoc(doc(db, "appointments", "a1"), {
      patientId: PATIENT,
      practitionerId: DR,
      status: "scheduled",
      start: new Date(),
    });
    await setDoc(doc(db, "assessmentAssignments", "as1"), {
      patientId: PATIENT,
      practitionerId: DR,
      formId: "phq9",
      status: "sent",
    });
    await setDoc(doc(db, "assessmentResults", "as0"), {
      patientId: PATIENT,
      practitionerId: DR,
      score: 12,
      safetyFlag: false,
      reviewed: false,
    });
    await setDoc(doc(db, "conversations", `${PATIENT}_${DR}`), {
      patientId: PATIENT,
      practitionerId: DR,
      participants: [PATIENT, DR],
    });
    await setDoc(doc(db, "availabilityRequests", "r1"), {
      practitionerId: DR,
      kind: "unavailable",
      from: "2026-11-01",
      to: "2026-11-07",
      status: "pending",
    });
  });
});

describe("patient files", () => {
  it("lets patients read their own file but not someone else's", async () => {
    await assertSucceeds(getDoc(doc(patient(), "patients", PATIENT)));
    await assertFails(getDoc(doc(patient(), "patients", OTHER_PATIENT)));
  });

  it("only lets care-team practitioners open a file", async () => {
    await assertSucceeds(getDoc(doc(dr(), "patients", PATIENT)));
    await assertFails(getDoc(doc(drOther(), "patients", PATIENT)));
    await assertSucceeds(getDocs(query(collection(dr(), "patients"), where("careTeam", "array-contains", DR))));
  });

  it("does not let patients change their own care team", async () => {
    await assertFails(updateDoc(doc(patient(), "patients", PATIENT), { careTeam: [DR, DR_OTHER] }));
    await assertSucceeds(updateDoc(doc(patient(), "patients", PATIENT), { phone: "+966500000000" }));
  });

  it("does not let users promote themselves", async () => {
    await assertFails(updateDoc(doc(patient(), "users", PATIENT), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(patient(), "users", PATIENT), { locale: "ar" }));
  });
});

describe("clinical notes and to-dos", () => {
  it("hides notes from the patient", async () => {
    await assertFails(getDoc(doc(patient(), "patients", PATIENT, "notes", "n1")));
    await assertFails(getDocs(collection(patient(), "patients", PATIENT, "notes")));
  });

  it("hides notes from practitioners outside the care team", async () => {
    await assertFails(getDoc(doc(drOther(), "patients", PATIENT, "notes", "n1")));
    await assertFails(
      addDoc(collection(drOther(), "patients", PATIENT, "notes"), { authorId: DR_OTHER, body: "x", createdAt: serverTimestamp() }),
    );
  });

  it("lets the care team write notes as themselves only", async () => {
    await assertSucceeds(
      addDoc(collection(dr(), "patients", PATIENT, "notes"), { authorId: DR, body: "ok", createdAt: serverTimestamp() }),
    );
    await assertFails(
      addDoc(collection(dr(), "patients", PATIENT, "notes"), { authorId: "someone", body: "x", createdAt: serverTimestamp() }),
    );
  });

  it("lets the care team manage to-dos", async () => {
    const ref = await assertSucceeds(
      addDoc(collection(dr(), "patients", PATIENT, "tasks"), { authorId: DR, title: "Call GP", done: false, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(ref, { done: true }));
    await assertFails(getDocs(collection(patient(), "patients", PATIENT, "tasks")));
  });
});

describe("appointments", () => {
  it("does not let patients create appointments directly", async () => {
    await assertFails(
      addDoc(collection(patient(), "appointments"), { patientId: PATIENT, practitionerId: DR, status: "scheduled" }),
    );
  });

  it("lets patients list their own appointments", async () => {
    await assertSucceeds(getDocs(query(collection(patient(), "appointments"), where("patientId", "==", PATIENT))));
    await assertFails(getDocs(collection(patient(), "appointments")));
  });

  it("lets the session's practitioner record the outcome but nothing else", async () => {
    await assertSucceeds(updateDoc(doc(dr(), "appointments", "a1"), { status: "completed" }));
    await assertFails(updateDoc(doc(dr(), "appointments", "a1"), { patientId: OTHER_PATIENT }));
    await assertFails(updateDoc(doc(drOther(), "appointments", "a1"), { status: "cancelled" }));
    await assertFails(updateDoc(doc(patient(), "appointments", "a1"), { status: "cancelled" }));
  });
});

describe("assessments", () => {
  it("lets the patient submit answers once, without scores", async () => {
    await assertFails(
      updateDoc(doc(patient(), "assessmentAssignments", "as1"), {
        answers: { q1: 0 },
        status: "completed",
        completedAt: serverTimestamp(),
        score: 0,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(patient(), "assessmentAssignments", "as1"), {
        answers: { q1: 0 },
        status: "completed",
        completedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(patient(), "assessmentAssignments", "as1"), {
        answers: { q1: 3 },
        status: "completed",
        completedAt: serverTimestamp(),
      }),
    );
  });

  it("keeps scores and safety flags away from patients", async () => {
    await assertFails(getDoc(doc(patient(), "assessmentResults", "as0")));
    await assertSucceeds(getDoc(doc(dr(), "assessmentResults", "as0")));
    await assertFails(getDoc(doc(drOther(), "assessmentResults", "as0")));
    await assertFails(updateDoc(doc(dr(), "assessmentResults", "as0"), { score: 0 }));
    await assertSucceeds(updateDoc(doc(dr(), "assessmentResults", "as0"), { reviewed: true }));
  });

  it("only lets the care team send forms", async () => {
    await assertSucceeds(
      addDoc(collection(dr(), "assessmentAssignments"), { patientId: PATIENT, practitionerId: DR, formId: "gad7", status: "sent" }),
    );
    await assertFails(
      addDoc(collection(drOther(), "assessmentAssignments"), {
        patientId: PATIENT,
        practitionerId: DR_OTHER,
        formId: "gad7",
        status: "sent",
      }),
    );
  });
});

describe("transfers", () => {
  const transfer = (from: string, to: string) => ({
    patientId: PATIENT,
    patientName: "Pat",
    fromPractitionerId: from,
    toPractitionerId: to,
    reason: "Needs medication review",
    keepAccess: false,
    status: "pending",
  });

  it("lets a care-team practitioner start a transfer", async () => {
    await assertSucceeds(addDoc(collection(dr(), "transfers"), transfer(DR, DR_OTHER)));
  });

  it("blocks transfers of patients you don't treat, or already accepted ones", async () => {
    await assertFails(addDoc(collection(drOther(), "transfers"), transfer(DR_OTHER, DR)));
    await assertFails(addDoc(collection(dr(), "transfers"), { ...transfer(DR, DR_OTHER), status: "accepted" }));
  });
});

describe("availability requests", () => {
  it("lets practitioners request but not approve their own time off", async () => {
    await assertSucceeds(
      addDoc(collection(dr(), "availabilityRequests"), {
        practitionerId: DR,
        kind: "available",
        from: "2026-11-10",
        to: "2026-11-10",
        hours: { start: "18:00", end: "21:00" },
        status: "pending",
      }),
    );
    await assertFails(updateDoc(doc(dr(), "availabilityRequests", "r1"), { status: "approved" }));
    await assertFails(updateDoc(doc(dr(), "practitioners", DR), { blockedRanges: [{ from: "2026-11-01", to: "2026-11-30" }] }));
    await assertSucceeds(deleteDoc(doc(dr(), "availabilityRequests", "r1")));
  });
});

describe("messages", () => {
  const messages = (db: ReturnType<typeof patient>) => collection(db, "conversations", `${PATIENT}_${DR}`, "messages");

  it("lets both sides of a conversation message each other", async () => {
    await assertSucceeds(addDoc(messages(patient()), { senderId: PATIENT, text: "Hello", createdAt: serverTimestamp() }));
    await assertSucceeds(addDoc(messages(dr()), { senderId: DR, text: "Hi", createdAt: serverTimestamp() }));
  });

  it("keeps outsiders out and stops patients faking a form", async () => {
    await assertFails(getDocs(messages(drOther())));
    await assertFails(
      addDoc(messages(patient()), { senderId: PATIENT, text: "x", assessmentAssignmentId: "as1", createdAt: serverTimestamp() }),
    );
    await assertFails(addDoc(messages(patient()), { senderId: DR, text: "spoof", createdAt: serverTimestamp() }));
  });
});

describe("admin", () => {
  it("can read any file but practitioners can't edit clinic-wide forms", async () => {
    await assertSucceeds(getDoc(doc(admin(), "patients", OTHER_PATIENT)));
    await assertFails(setDoc(doc(dr(), "assessmentForms", "custom"), { code: "X" }));
    await assertSucceeds(setDoc(doc(admin(), "assessmentForms", "custom"), { code: "X" }));
  });
});
