// Firestore document shapes shared by the patient app, the dashboard and Cloud Functions.
// Collection paths are listed in COLLECTIONS so every client uses the same names.

/** Works with both the client SDK and the Admin SDK Timestamp classes. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export const COLLECTIONS = {
  users: "users",
  practitioners: "practitioners",
  patients: "patients",
  notes: "notes", // subcollection of patients/{patientId}
  tasks: "tasks", // subcollection of patients/{patientId}
  appointments: "appointments",
  transfers: "transfers",
  availabilityRequests: "availabilityRequests",
  templates: "templates",
  assessmentForms: "assessmentForms",
  assessmentAssignments: "assessmentAssignments",
  assessmentResults: "assessmentResults",
  bookedSlots: "bookedSlots", // {practitionerId}_{yyyy-mm-dd} -> { times: ["09:00"] }, no patient details
  conversations: "conversations",
  messages: "messages", // subcollection of conversations/{conversationId}
} as const;

export type Role = "patient" | "practitioner" | "admin";
export type Locale = "en" | "ar";

/** users/{uid}. Role is mirrored from the auth custom claim, which is what security rules trust. */
export interface UserProfile {
  role: Role;
  displayName: string;
  email: string;
  locale: Locale;
  photoUrl?: string;
  createdAt: TimestampLike;
}

export type Discipline = "psychiatry" | "psychology";

/** Weekly working hours, keyed by weekday (0 = Sunday). Times are "HH:mm" in the practitioner's time zone. */
export type WeeklyHours = Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, { start: string; end: string }[]>>;

/** practitioners/{uid}. Public profile that patients can read. */
export interface Practitioner {
  displayName: string;
  displayNameAr?: string;
  discipline: Discipline;
  title: string; // e.g. "Consultant Psychiatrist"
  titleAr?: string;
  bio?: string;
  bioAr?: string;
  photoUrl?: string;
  languages: Locale[];
  sessionMinutes: number;
  timeZone: string; // IANA, e.g. "Asia/Riyadh"
  weeklyHours: WeeklyHours;
  /** Date ranges blocked by approved "not available" requests. ISO dates (yyyy-mm-dd), inclusive. */
  blockedRanges: { from: string; to: string }[];
  /** Extra dates opened by approved "available" requests. */
  extraDays: { date: string; start: string; end: string }[];
  active: boolean;
}

export type PatientStatus = "active" | "on_hold" | "discharged";

/** patients/{uid}. Readable by the patient and by practitioners on their care team. */
export interface Patient {
  displayName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: "female" | "male";
  primaryPractitionerId: string | null;
  /** Practitioner uids allowed to see this file. Security rules rely on this list. */
  careTeam: string[];
  status: PatientStatus;
  completedSessions: number; // maintained by Cloud Functions
  lastSessionAt?: TimestampLike;
  createdAt: TimestampLike;
}

/** patients/{patientId}/notes/{id}. Clinical notes, never visible to the patient. */
export interface ClinicalNote {
  authorId: string;
  authorName: string;
  body: string;
  appointmentId?: string;
  createdAt: TimestampLike;
  updatedAt?: TimestampLike;
}

/** patients/{patientId}/tasks/{id}. Practitioner to-do items about this patient. */
export interface PatientTask {
  authorId: string;
  title: string;
  done: boolean;
  dueDate?: string; // yyyy-mm-dd
  createdAt: TimestampLike;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type SessionMode = "video" | "audio" | "chat";

/** appointments/{id}. Created only by the bookAppointment function so double booking can't happen. */
export interface Appointment {
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  start: TimestampLike;
  end: TimestampLike;
  mode: SessionMode;
  status: AppointmentStatus;
  meetingUrl?: string;
  cancelReason?: string;
  createdAt: TimestampLike;
}

export type TransferStatus = "pending" | "accepted" | "declined" | "cancelled";

/** transfers/{id}. Handing a patient over to another practitioner. */
export interface Transfer {
  patientId: string;
  patientName: string;
  fromPractitionerId: string;
  fromPractitionerName: string;
  toPractitionerId: string;
  toPractitionerName: string;
  reason: string;
  /** Keep the sending practitioner on the care team after the handover. */
  keepAccess: boolean;
  status: TransferStatus;
  createdAt: TimestampLike;
  respondedAt?: TimestampLike;
}

export type AvailabilityKind = "unavailable" | "available";
export type RequestStatus = "pending" | "approved" | "rejected";

/** availabilityRequests/{id}. "I won't see patients this week" or "I'm available these days". */
export interface AvailabilityRequest {
  practitionerId: string;
  practitionerName: string;
  kind: AvailabilityKind;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  /** For kind "available": the hours offered on each day in the range. */
  hours?: { start: string; end: string };
  note?: string;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: TimestampLike;
  createdAt: TimestampLike;
}

export type TemplateKind = "message" | "assessment";

/** templates/{id}. Saved messages a practitioner can send in one tap. */
export interface MessageTemplate {
  ownerId: string;
  /** Shared templates are visible to every practitioner. Only admins can create them. */
  shared: boolean;
  kind: TemplateKind;
  title: string;
  body: string;
  locale: Locale;
  /** For kind "assessment": the form sent along with the message. */
  formId?: string;
  createdAt: TimestampLike;
}

export interface AssessmentOption {
  label: string;
  labelAr?: string;
  value: number;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  textAr?: string;
  options: AssessmentOption[];
}

export interface SeverityBand {
  min: number;
  max: number;
  label: string;
  labelAr?: string;
  level: 0 | 1 | 2 | 3 | 4;
}

/** assessmentForms/{id}. Standard questionnaires such as PHQ-9 and GAD-7. */
export interface AssessmentForm {
  code: string; // "PHQ-9"
  title: string;
  titleAr?: string;
  instructions: string;
  instructionsAr?: string;
  questions: AssessmentQuestion[];
  bands: SeverityBand[];
  /** Question ids that raise a safety flag when answered above 0 (e.g. PHQ-9 item 9). */
  safetyItems?: string[];
  active: boolean;
}

export type AssignmentStatus = "sent" | "completed";

/** assessmentAssignments/{id}. One form sent to one patient. */
export interface AssessmentAssignment {
  patientId: string;
  patientName: string;
  practitionerId: string;
  formId: string;
  formCode: string;
  formTitle: string;
  status: AssignmentStatus;
  /** Written by the patient once, when they submit. */
  answers?: Record<string, number>;
  sentAt: TimestampLike;
  completedAt?: TimestampLike;
}

/**
 * assessmentResults/{assignmentId}. Written only by the scoring function and readable only
 * by the care team, so patients never see raw scores or safety flags.
 */
export interface AssessmentResult {
  patientId: string;
  practitionerId: string;
  formId: string;
  formCode: string;
  score: number;
  maxScore: number;
  severity: string;
  severityLevel: number;
  /** A safety item (e.g. PHQ-9 item 9) was answered above 0. Needs same-day follow-up. */
  safetyFlag: boolean;
  reviewed: boolean;
  completedAt: TimestampLike;
}

/** conversations/{patientId}_{practitionerId} */
export interface Conversation {
  patientId: string;
  practitionerId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: TimestampLike;
}

/** conversations/{id}/messages/{id} */
export interface ChatMessage {
  senderId: string;
  text: string;
  templateId?: string;
  assessmentAssignmentId?: string;
  createdAt: TimestampLike;
  readAt?: TimestampLike;
}

export const conversationId = (patientId: string, practitionerId: string) =>
  `${patientId}_${practitionerId}`;
