import {
  conversationId,
  scoreAssessment,
  slotsForDate,
  zonedToUtc,
  type Appointment,
  type AssessmentAssignment,
  type AssessmentForm,
  type AvailabilityRequest,
  type ChatMessage,
  type Discipline,
  type Patient,
  type Practitioner,
  type Role,
  type SessionMode,
  type Transfer,
} from "@chester/shared";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

// Keep this the same as the Firestore database location so data stays in one region.
const REGION = "me-central2";
setGlobalOptions({ region: REGION, maxInstances: 10 });

// ---------------------------------------------------------------------------
// Helpers

function requireRole(req: CallableRequest, ...roles: Role[]) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const role = req.auth.token.role as Role | undefined;
  if (!role || !roles.includes(role)) throw new HttpsError("permission-denied", "You can't do that.");
  return { uid: req.auth.uid, role };
}

function requireString(value: unknown, name: string, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HttpsError("invalid-argument", `${name} is required.`);
  }
  return value.trim();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

// ---------------------------------------------------------------------------
// Accounts

/** Called by the patient app right after sign-up. Creates the patient file and sets the role. */
export const registerPatient = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { uid } = req.auth;
  const existingRole = req.auth.token.role as Role | undefined;
  if (existingRole && existingRole !== "patient") {
    throw new HttpsError("failed-precondition", "This account is not a patient account.");
  }
  const displayName = requireString(req.data?.displayName, "Name", 120);
  const phone = typeof req.data?.phone === "string" ? req.data.phone.slice(0, 30) : undefined;
  const email = req.auth.token.email ?? "";

  await getAuth().setCustomUserClaims(uid, { role: "patient" });
  const batch = db.batch();
  batch.set(
    db.doc(`users/${uid}`),
    { role: "patient", displayName, email, locale: "en", createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  const patientRef = db.doc(`patients/${uid}`);
  if (!(await patientRef.get()).exists) {
    batch.set(patientRef, {
      displayName,
      email,
      ...(phone ? { phone } : {}),
      primaryPractitionerId: null,
      careTeam: [],
      status: "active",
      completedSessions: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  return { ok: true };
});

/** Admin only. Creates (or upgrades) a practitioner account and returns a link to set a password. */
export const createPractitioner = onCall(async (req) => {
  requireRole(req, "admin");
  const email = requireString(req.data?.email, "Email", 200).toLowerCase();
  const displayName = requireString(req.data?.displayName, "Name", 120);
  const title = requireString(req.data?.title, "Title", 120);
  const discipline = req.data?.discipline as Discipline;
  if (discipline !== "psychiatry" && discipline !== "psychology") {
    throw new HttpsError("invalid-argument", "Discipline must be psychiatry or psychology.");
  }
  const timeZone = typeof req.data?.timeZone === "string" ? req.data.timeZone : "Asia/Riyadh";
  const makeAdmin = req.data?.admin === true;

  const auth = getAuth();
  const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, displayName }));
  await auth.setCustomUserClaims(user.uid, { role: makeAdmin ? "admin" : "practitioner" });

  const practitioner: Practitioner = {
    displayName,
    discipline,
    title,
    languages: ["en", "ar"],
    sessionMinutes: 50,
    timeZone,
    // Sunday to Thursday, 9:00 to 17:00. Practitioners adjust this in the dashboard.
    weeklyHours: Object.fromEntries(
      [0, 1, 2, 3, 4].map((d) => [d, [{ start: "09:00", end: "17:00" }]]),
    ) as Practitioner["weeklyHours"],
    blockedRanges: [],
    extraDays: [],
    active: true,
  };
  await db.doc(`practitioners/${user.uid}`).set(practitioner, { merge: true });
  await db.doc(`users/${user.uid}`).set(
    {
      role: makeAdmin ? "admin" : "practitioner",
      displayName,
      email,
      locale: "en",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const setPasswordLink = await auth.generatePasswordResetLink(email);
  return { uid: user.uid, setPasswordLink };
});

// ---------------------------------------------------------------------------
// Appointments

/** Books a slot in a transaction so two patients can't take the same time. */
export const bookAppointment = onCall(async (req) => {
  const { uid } = requireRole(req, "patient");
  const practitionerId = requireString(req.data?.practitionerId, "Practitioner", 128);
  const date = requireString(req.data?.date, "Date", 10);
  const time = requireString(req.data?.time, "Time", 5);
  const mode = (req.data?.mode ?? "video") as SessionMode;
  if (!ISO_DATE.test(date) || !HHMM.test(time)) throw new HttpsError("invalid-argument", "Invalid date or time.");
  if (!["video", "audio", "chat"].includes(mode)) throw new HttpsError("invalid-argument", "Invalid session type.");

  const appointmentRef = db.collection("appointments").doc();
  const slotsRef = db.doc(`bookedSlots/${practitionerId}_${date}`);
  const practitionerRef = db.doc(`practitioners/${practitionerId}`);
  const patientRef = db.doc(`patients/${uid}`);

  await db.runTransaction(async (tx) => {
    const [pSnap, slotsSnap, patientSnap] = await Promise.all([
      tx.get(practitionerRef),
      tx.get(slotsRef),
      tx.get(patientRef),
    ]);
    const practitioner = pSnap.data() as Practitioner | undefined;
    const patient = patientSnap.data() as Patient | undefined;
    if (!practitioner?.active) throw new HttpsError("not-found", "This specialist is not taking bookings.");
    if (!patient) throw new HttpsError("failed-precondition", "Finish creating your account first.");

    const taken: string[] = slotsSnap.data()?.times ?? [];
    const open = slotsForDate(practitioner, date, taken).some((s) => s.time === time);
    if (!open) throw new HttpsError("already-exists", "That time is no longer available.");

    const start = zonedToUtc(date, time, practitioner.timeZone);
    if (start.getTime() < Date.now()) throw new HttpsError("invalid-argument", "That time has passed.");
    const end = new Date(start.getTime() + practitioner.sessionMinutes * 60_000);

    tx.set(appointmentRef, {
      patientId: uid,
      patientName: patient.displayName,
      practitionerId,
      practitionerName: practitioner.displayName,
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
      mode,
      status: "scheduled",
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(slotsRef, { practitionerId, date, times: FieldValue.arrayUnion(time) }, { merge: true });

    // Booking someone new adds them to the care team so they can see this patient's file.
    const patientUpdate: Record<string, unknown> = { careTeam: FieldValue.arrayUnion(practitionerId) };
    if (!patient.primaryPractitionerId) patientUpdate.primaryPractitionerId = practitionerId;
    tx.update(patientRef, patientUpdate);

    tx.set(
      db.doc(`conversations/${conversationId(uid, practitionerId)}`),
      { patientId: uid, practitionerId, participants: [uid, practitionerId] },
      { merge: true },
    );
  });

  return { appointmentId: appointmentRef.id };
});

/** Patients cancel through here; practitioners can also update the status directly in the dashboard. */
export const cancelAppointment = onCall(async (req) => {
  const { uid, role } = requireRole(req, "patient", "practitioner", "admin");
  const appointmentId = requireString(req.data?.appointmentId, "Appointment", 128);
  const ref = db.doc(`appointments/${appointmentId}`);
  const snap = await ref.get();
  const appt = snap.data() as Appointment | undefined;
  if (!appt) throw new HttpsError("not-found", "Session not found.");
  if (role === "patient" && appt.patientId !== uid) throw new HttpsError("permission-denied", "Not your session.");
  if (role === "practitioner" && appt.practitionerId !== uid) {
    throw new HttpsError("permission-denied", "Not your session.");
  }
  if (appt.status !== "scheduled") throw new HttpsError("failed-precondition", "This session can't be cancelled.");
  if (role === "patient" && appt.start.toMillis() < Date.now()) {
    throw new HttpsError("failed-precondition", "This session has already started.");
  }
  const reason = typeof req.data?.reason === "string" ? req.data.reason.slice(0, 500) : undefined;
  await ref.update({ status: "cancelled", ...(reason ? { cancelReason: reason } : {}) });
  return { ok: true };
});

/** Keeps session counts and the public booked-slot list in step with appointment status changes. */
export const onAppointmentUpdated = onDocumentUpdated("appointments/{id}", async (event) => {
  const before = event.data?.before.data() as Appointment | undefined;
  const after = event.data?.after.data() as Appointment | undefined;
  if (!before || !after || before.status === after.status) return;

  const patientRef = db.doc(`patients/${after.patientId}`);
  if (after.status === "completed") {
    await patientRef.update({ completedSessions: FieldValue.increment(1), lastSessionAt: after.start });
  } else if (before.status === "completed") {
    await patientRef.update({ completedSessions: FieldValue.increment(-1) });
  }

  if (after.status === "cancelled") {
    const practitioner = (await db.doc(`practitioners/${after.practitionerId}`).get()).data() as Practitioner;
    const tz = practitioner?.timeZone ?? "UTC";
    const start = after.start.toDate();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(start);
    await db.doc(`bookedSlots/${after.practitionerId}_${date}`).set({ times: FieldValue.arrayRemove(time) }, { merge: true });
  }
});

// ---------------------------------------------------------------------------
// Transfers

/** The receiving practitioner accepts or declines a transfer. Accepting moves the patient's file. */
export const respondToTransfer = onCall(async (req) => {
  const { uid } = requireRole(req, "practitioner", "admin");
  const transferId = requireString(req.data?.transferId, "Transfer", 128);
  const accept = req.data?.accept === true;
  const ref = db.doc(`transfers/${transferId}`);

  await db.runTransaction(async (tx) => {
    const transfer = (await tx.get(ref)).data() as Transfer | undefined;
    if (!transfer) throw new HttpsError("not-found", "Transfer not found.");
    if (transfer.toPractitionerId !== uid) throw new HttpsError("permission-denied", "This transfer isn't addressed to you.");
    if (transfer.status !== "pending") throw new HttpsError("failed-precondition", "This transfer was already handled.");

    // Transactions need every read before the first write.
    const patientRef = db.doc(`patients/${transfer.patientId}`);
    const patient = (await tx.get(patientRef)).data() as Patient | undefined;

    tx.update(ref, { status: accept ? "accepted" : "declined", respondedAt: FieldValue.serverTimestamp() });
    if (!accept) return;
    if (!patient) throw new HttpsError("not-found", "Patient file not found.");
    const careTeam = new Set(patient.careTeam);
    careTeam.add(transfer.toPractitionerId);
    if (!transfer.keepAccess) careTeam.delete(transfer.fromPractitionerId);
    tx.update(patientRef, { primaryPractitionerId: transfer.toPractitionerId, careTeam: [...careTeam] });
    tx.set(
      db.doc(`conversations/${conversationId(transfer.patientId, transfer.toPractitionerId)}`),
      {
        patientId: transfer.patientId,
        practitionerId: transfer.toPractitionerId,
        participants: [transfer.patientId, transfer.toPractitionerId],
      },
      { merge: true },
    );
  });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Availability requests

/** Admin approves or rejects "not available" / "available" requests and updates the schedule. */
export const reviewAvailabilityRequest = onCall(async (req) => {
  const { uid } = requireRole(req, "admin");
  const requestId = requireString(req.data?.requestId, "Request", 128);
  const approve = req.data?.approve === true;
  const ref = db.doc(`availabilityRequests/${requestId}`);
  let affectedAppointments = 0;

  await db.runTransaction(async (tx) => {
    const request = (await tx.get(ref)).data() as AvailabilityRequest | undefined;
    if (!request) throw new HttpsError("not-found", "Request not found.");
    if (request.status !== "pending") throw new HttpsError("failed-precondition", "Already reviewed.");
    tx.update(ref, { status: approve ? "approved" : "rejected", reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp() });
    if (!approve) return;

    const practitionerRef = db.doc(`practitioners/${request.practitionerId}`);
    if (request.kind === "unavailable") {
      tx.update(practitionerRef, { blockedRanges: FieldValue.arrayUnion({ from: request.from, to: request.to }) });
    } else if (request.hours) {
      const days: { date: string; start: string; end: string }[] = [];
      for (let d = new Date(`${request.from}T12:00:00Z`); d <= new Date(`${request.to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        days.push({ date: d.toISOString().slice(0, 10), ...request.hours });
      }
      tx.update(practitionerRef, { extraDays: FieldValue.arrayUnion(...days) });
    }
  });

  // Tell the admin how many booked sessions fall inside a newly blocked range, so they can be moved.
  const request = (await ref.get()).data() as AvailabilityRequest;
  if (approve && request.kind === "unavailable") {
    const practitioner = (await db.doc(`practitioners/${request.practitionerId}`).get()).data() as Practitioner;
    const from = zonedToUtc(request.from, "00:00", practitioner.timeZone);
    const to = zonedToUtc(request.to, "23:59", practitioner.timeZone);
    const clash = await db
      .collection("appointments")
      .where("practitionerId", "==", request.practitionerId)
      .where("status", "==", "scheduled")
      .where("start", ">=", Timestamp.fromDate(from))
      .where("start", "<=", Timestamp.fromDate(to))
      .count()
      .get();
    affectedAppointments = clash.data().count;
  }
  return { ok: true, affectedAppointments };
});

// ---------------------------------------------------------------------------
// Assessments

/** Scores a submitted form and stores the result where only the care team can read it. */
export const onAssessmentSubmitted = onDocumentUpdated("assessmentAssignments/{id}", async (event) => {
  const before = event.data?.before.data() as AssessmentAssignment | undefined;
  const after = event.data?.after.data() as AssessmentAssignment | undefined;
  if (!before || !after || before.status === "completed" || after.status !== "completed") return;

  const form = (await db.doc(`assessmentForms/${after.formId}`).get()).data() as AssessmentForm | undefined;
  if (!form) return;
  const result = scoreAssessment(form, after.answers ?? {});
  await db.doc(`assessmentResults/${event.params.id}`).set({
    patientId: after.patientId,
    practitionerId: after.practitionerId,
    formId: after.formId,
    formCode: form.code,
    score: result.score,
    maxScore: result.maxScore,
    severity: result.band?.label ?? "Unknown",
    severityLevel: result.band?.level ?? 0,
    safetyFlag: result.safetyFlag,
    incomplete: result.missing.length > 0,
    reviewed: false,
    completedAt: after.completedAt ?? FieldValue.serverTimestamp(),
  });
});

// ---------------------------------------------------------------------------
// Messages

/** Keeps the conversation preview (last message and time) up to date. */
export const onMessageCreated = onDocumentCreated("conversations/{conversationId}/messages/{messageId}", async (event) => {
  const message = event.data?.data() as ChatMessage | undefined;
  if (!message) return;
  await db.doc(`conversations/${event.params.conversationId}`).set(
    {
      lastMessage: message.text.slice(0, 140),
      lastMessageAt: message.createdAt ?? FieldValue.serverTimestamp(),
      lastSenderId: message.senderId,
    },
    { merge: true },
  );
});
