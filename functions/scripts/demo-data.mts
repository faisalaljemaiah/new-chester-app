// Fills the LOCAL EMULATORS with made-up demo data so you can click around both apps.
// Refuses to run against a real project. Start the emulators first (npm run emulators), then:
//   npm run demo -w functions
// Sign-ins it creates (password "demo-password"):
//   admin@demo.clinic (admin + psychiatrist), layla@demo.clinic (psychologist), patient@demo.clinic (patient)
import { SEED_FORMS, scoreAssessment } from "@chester/shared";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST. This script only writes to emulators.");
  process.exit(1);
}

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-chester" });
const auth = getAuth();
const db = getFirestore();
const PASSWORD = "demo-password";

async function user(email: string, displayName: string, role: string) {
  const u = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, displayName, password: PASSWORD }));
  await auth.setCustomUserClaims(u.uid, { role });
  await db.doc(`users/${u.uid}`).set({ role, displayName, email, locale: "en", createdAt: Timestamp.now() });
  return u.uid;
}

const hours = Object.fromEntries([0, 1, 2, 3, 4].map((d) => [d, [{ start: "09:00", end: "17:00" }]]));
const practitioner = (displayName: string, displayNameAr: string, discipline: string, title: string) => ({
  displayName,
  displayNameAr,
  discipline,
  title,
  languages: ["en", "ar"],
  sessionMinutes: 50,
  timeZone: "Asia/Riyadh",
  weeklyHours: hours,
  blockedRanges: [],
  extraDays: [],
  active: true,
});

const admin = await user("admin@demo.clinic", "Dr. Omar Haddad", "admin");
const layla = await user("layla@demo.clinic", "Dr. Layla Nasser", "practitioner");
const pat = await user("patient@demo.clinic", "Emma Saleh", "patient");
await db.doc(`practitioners/${admin}`).set(practitioner("Dr. Omar Haddad", "د. عمر حداد", "psychiatry", "Consultant Psychiatrist"));
await db.doc(`practitioners/${layla}`).set(practitioner("Dr. Layla Nasser", "د. ليلى ناصر", "psychology", "Clinical Psychologist"));

const others = [
  ["Khalid Al-Amri", "khalid@example.com"],
  ["Sara Mansour", "sara@example.com"],
  ["Yousef Darwish", "yousef@example.com"],
];
const patients: [string, string][] = [[pat, "Emma Saleh"]];
for (const [name, email] of others) {
  const ref = db.collection("patients").doc();
  patients.push([ref.id, name]);
  await ref.set({ displayName: name, email, primaryPractitionerId: admin, careTeam: [admin], status: "active", completedSessions: 0, createdAt: Timestamp.now() });
}
await db.doc(`patients/${pat}`).set({
  displayName: "Emma Saleh",
  email: "patient@demo.clinic",
  phone: "+966 50 000 0000",
  primaryPractitionerId: admin,
  careTeam: [admin],
  status: "active",
  completedSessions: 0,
  createdAt: Timestamp.now(),
});

const day = 86_400_000;
const at = (offsetDays: number, hour: number) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};
let i = 0;
for (const [pid, name] of patients) {
  const sessions = [
    [-28, 10, "completed"],
    [-21, 10, "completed"],
    [-14, 10, "completed"],
    [-7, 10, "no_show"],
    [0, 11 + i, "scheduled"],
    [7, 10 + i, "scheduled"],
  ] as const;
  let completed = 0;
  for (const [offset, hour, status] of sessions) {
    const start = at(offset, hour);
    if (status === "completed") completed++;
    await db.collection("appointments").add({
      patientId: pid,
      patientName: name,
      practitionerId: admin,
      practitionerName: "Dr. Omar Haddad",
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(new Date(start.getTime() + 50 * 60_000)),
      mode: "video",
      status,
      createdAt: Timestamp.now(),
    });
  }
  await db.doc(`patients/${pid}`).update({ completedSessions: completed, lastSessionAt: Timestamp.fromDate(at(-14, 10)) });
  await db.doc(`conversations/${pid}_${admin}`).set({ patientId: pid, practitionerId: admin, participants: [pid, admin] });
  i++;
}

for (const [id, form] of Object.entries(SEED_FORMS)) await db.doc(`assessmentForms/${id}`).set(form);

// Emma's PHQ-9 and GAD-7 trending down over four check-ins; the latest PHQ-9 for Khalid is flagged.
const series: [string, string, number[], string][] = [
  [pat, "phq9", [18, 15, 11, 8], "Emma Saleh"],
  [pat, "gad7", [14, 12, 9, 7], "Emma Saleh"],
  [patients[1][0], "phq9", [12, 16], patients[1][1]],
];
for (const [pid, formId, scores, name] of series) {
  const form = SEED_FORMS[formId];
  for (const [k, target] of scores.entries()) {
    const answers: Record<string, number> = {};
    let left = target;
    for (const q of form.questions) {
      const v = Math.min(3, left);
      answers[q.id] = v;
      left -= v;
    }
    // Make the last PHQ-9 for Khalid answer item 9 so the safety alert shows.
    if (pid === patients[1][0] && k === scores.length - 1) answers.q9 = 1;
    const result = scoreAssessment(form, answers);
    const when = Timestamp.fromDate(at(-28 + k * 7, 9));
    const ref = db.collection("assessmentAssignments").doc();
    await ref.set({ patientId: pid, patientName: name, practitionerId: admin, formId, formCode: form.code, formTitle: form.title, status: "completed", answers, sentAt: when, completedAt: when });
    await db.doc(`assessmentResults/${ref.id}`).set({
      patientId: pid,
      practitionerId: admin,
      formId,
      formCode: form.code,
      score: result.score,
      maxScore: result.maxScore,
      severity: result.band?.label ?? "",
      severityLevel: result.band?.level ?? 0,
      safetyFlag: result.safetyFlag,
      reviewed: k < scores.length - 1,
      completedAt: when,
    });
  }
}
await db.collection("assessmentAssignments").add({
  patientId: pat, patientName: "Emma Saleh", practitionerId: admin, formId: "gad7", formCode: "GAD-7", formTitle: SEED_FORMS.gad7.title, status: "sent", sentAt: Timestamp.now(),
});

await db.collection(`patients/${pat}/notes`).add({
  authorId: admin,
  authorName: "Dr. Omar Haddad",
  body: "Sleep improving since starting the routine. Continue CBT-I worksheet; review in two weeks.",
  createdAt: Timestamp.fromDate(at(-7, 12)),
});
await db.collection(`patients/${pat}/tasks`).add({ authorId: admin, title: "Send sleep diary template", done: false, dueDate: new Date(Date.now() + 2 * day).toISOString().slice(0, 10), createdAt: Timestamp.now() });
await db.collection(`patients/${pat}/tasks`).add({ authorId: admin, title: "Coordinate with GP about labs", done: true, createdAt: Timestamp.now() });

await db.collection("transfers").add({
  patientId: patients[2][0], patientName: patients[2][1], fromPractitionerId: layla, fromPractitionerName: "Dr. Layla Nasser",
  toPractitionerId: admin, toPractitionerName: "Dr. Omar Haddad", reason: "Needs a medication review alongside therapy.",
  keepAccess: true, status: "pending", createdAt: Timestamp.now(),
});
await db.doc(`patients/${patients[2][0]}`).update({ careTeam: [admin, layla] });
await db.collection("availabilityRequests").add({
  practitionerId: layla, practitionerName: "Dr. Layla Nasser", kind: "unavailable",
  from: new Date(Date.now() + 7 * day).toISOString().slice(0, 10), to: new Date(Date.now() + 11 * day).toISOString().slice(0, 10),
  note: "Conference", status: "pending", createdAt: Timestamp.now(),
});
for (const t of [
  { id: "welcome-en", kind: "message", locale: "en", title: "Welcome", body: "Welcome to New Chester Clinic. Message me here any time before our first session." },
  { id: "welcome-ar", kind: "message", locale: "ar", title: "ترحيب", body: "أهلاً بك في عيادة نيو تشستر. يمكنك مراسلتي هنا في أي وقت قبل جلستنا الأولى." },
  { id: "phq9-en", kind: "assessment", locale: "en", formId: "phq9", title: "PHQ-9 check-in", body: "Please fill in this short questionnaire before our next session." },
]) {
  const { id, ...rest } = t;
  await db.doc(`templates/${id}`).set({ ...rest, ownerId: admin, shared: true, createdAt: Timestamp.now() });
}

console.log(`Demo data ready. Sign in with admin@demo.clinic, layla@demo.clinic or patient@demo.clinic / ${PASSWORD}`);
