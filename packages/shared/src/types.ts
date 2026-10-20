// Row shapes of the Supabase tables in supabase/migrations, shared by the patient app and the
// dashboard. Field names match the database columns. Timestamps arrive as ISO strings.

export type Timestamp = string;
/** yyyy-mm-dd */
export type IsoDate = string;

export const TABLES = {
  profiles: "profiles",
  practitioners: "practitioners",
  patients: "patients",
  careTeam: "care_team",
  notes: "notes",
  tasks: "tasks",
  appointments: "appointments",
  transfers: "transfers",
  availabilityRequests: "availability_requests",
  templates: "templates",
  assessmentForms: "assessment_forms",
  assessmentAssignments: "assessment_assignments",
  assessmentResults: "assessment_results",
  conversations: "conversations",
  messages: "messages",
  practitionerChangeRequests: "practitioner_change_requests",
  rescheduleRequests: "reschedule_requests",
} as const;

export type Role = "patient" | "practitioner" | "admin";
export type Locale = "en" | "ar";

/** Every signed-in user has one. Only database functions change the role. */
export interface Profile {
  id: string;
  role: Role;
  display_name: string;
  email: string;
  locale: Locale;
  photo_url: string | null;
  created_at: Timestamp;
}

export type Discipline = "psychiatry" | "psychology";

export interface TimeWindow {
  start: string; // HH:mm in the practitioner's time zone
  end: string;
}

/** Weekly working hours keyed by weekday, "0" = Sunday. */
export type WeeklyHours = Partial<Record<string, TimeWindow[]>>;

/** Public profile that patients can read. */
export interface Practitioner {
  id: string;
  display_name: string;
  display_name_ar: string | null;
  discipline: Discipline;
  title: string; // e.g. "Consultant Psychiatrist"
  title_ar: string | null;
  bio: string | null;
  bio_ar: string | null;
  photo_url: string | null;
  languages: Locale[];
  session_minutes: number;
  time_zone: string; // IANA, e.g. "Asia/Riyadh"
  weekly_hours: WeeklyHours;
  /** Date ranges blocked by approved "not available" requests, inclusive. */
  blocked_ranges: { from: IsoDate; to: IsoDate }[];
  /** Extra dates opened by approved "available" requests. */
  extra_days: ({ date: IsoDate } & TimeWindow)[];
  active: boolean;
  /** Price of one session in SAR, set by an admin. 0 until set. */
  session_fee: number;
}

export type PatientStatus = "active" | "on_hold" | "discharged";

/** The patient file. Readable by the patient and by practitioners on their care team. */
export interface Patient {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  date_of_birth: IsoDate | null;
  primary_practitioner_id: string | null;
  status: PatientStatus;
  completed_sessions: number;
  last_session_at: Timestamp | null;
  created_at: Timestamp;
}

export interface CareTeamMember {
  patient_id: string;
  practitioner_id: string;
  added_at: Timestamp;
}

/** Clinical note, never visible to the patient. */
export interface ClinicalNote {
  id: string;
  patient_id: string;
  author_id: string;
  author_name: string;
  body: string;
  appointment_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp | null;
}

/** Practitioner to-do item about a patient. */
export interface PatientTask {
  id: string;
  patient_id: string;
  author_id: string;
  title: string;
  done: boolean;
  due_date: IsoDate | null;
  created_at: Timestamp;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type SessionMode = "video" | "audio" | "chat";

/** Created only by book_appointment(), so double booking can't happen. */
export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  practitioner_id: string;
  practitioner_name: string;
  start_at: Timestamp;
  end_at: Timestamp;
  mode: SessionMode;
  status: AppointmentStatus;
  meeting_url: string | null;
  cancel_reason: string | null;
  created_at: Timestamp;
  /** The practitioner's session fee (SAR) when this was booked. */
  fee: number;
}

export type TransferStatus = "pending" | "accepted" | "declined" | "cancelled";

/** Handing a patient over to another practitioner. */
export interface Transfer {
  id: string;
  patient_id: string;
  patient_name: string;
  from_practitioner_id: string;
  from_practitioner_name: string;
  to_practitioner_id: string;
  to_practitioner_name: string;
  reason: string;
  /** Keep the sending practitioner on the care team after the handover. */
  keep_access: boolean;
  status: TransferStatus;
  created_at: Timestamp;
  responded_at: Timestamp | null;
}

export type AvailabilityKind = "unavailable" | "available";
export type RequestStatus = "pending" | "approved" | "rejected";

/** "I won't see patients this week" or "I'm available these days". */
export interface AvailabilityRequest {
  id: string;
  practitioner_id: string;
  practitioner_name: string;
  kind: AvailabilityKind;
  from_date: IsoDate;
  to_date: IsoDate;
  /** For kind "available": the hours offered on each day in the range. */
  hours: TimeWindow | null;
  note: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: Timestamp | null;
  created_at: Timestamp;
}

export type TemplateKind = "message" | "assessment";

/** Saved messages a practitioner can send in one tap. */
export interface MessageTemplate {
  id: string;
  /** Empty for the clinic's starter templates. */
  owner_id: string | null;
  /** Shared templates are visible to every practitioner. Only admins create them. */
  shared: boolean;
  kind: TemplateKind;
  title: string;
  body: string;
  locale: Locale;
  /** For kind "assessment": the form sent along with the message. */
  form_id: string | null;
  created_at: Timestamp;
}

export interface AssessmentOption {
  label: string;
  label_ar?: string;
  value: number;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  text_ar?: string;
  options: AssessmentOption[];
}

export interface SeverityBand {
  min: number;
  max: number;
  label: string;
  label_ar?: string;
  level: 0 | 1 | 2 | 3 | 4;
}

/** Standard questionnaires such as PHQ-9 and GAD-7. */
export interface AssessmentForm {
  id: string; // "phq9"
  code: string; // "PHQ-9"
  title: string;
  title_ar: string | null;
  instructions: string;
  instructions_ar: string | null;
  questions: AssessmentQuestion[];
  bands: SeverityBand[];
  /** Question ids that raise a safety flag when answered above 0 (e.g. PHQ-9 item 9). */
  safety_items: string[];
  active: boolean;
}

export type AssignmentStatus = "sent" | "completed";

/** One form sent to one patient. */
export interface AssessmentAssignment {
  id: string;
  patient_id: string;
  patient_name: string;
  practitioner_id: string;
  form_id: string;
  form_code: string;
  form_title: string;
  status: AssignmentStatus;
  /** Written once, by submit_assessment(). */
  answers: Record<string, number> | null;
  sent_at: Timestamp;
  completed_at: Timestamp | null;
}

/** Written only by submit_assessment() and readable only by the care team. */
export interface AssessmentResult {
  assignment_id: string;
  patient_id: string;
  practitioner_id: string;
  form_id: string;
  form_code: string;
  score: number;
  max_score: number;
  severity: string;
  severity_level: number;
  /** A safety item (e.g. PHQ-9 item 9) was answered above 0. Needs same-day follow-up. */
  safety_flag: boolean;
  incomplete: boolean;
  reviewed: boolean;
  completed_at: Timestamp;
}

export interface Conversation {
  id: string;
  patient_id: string;
  practitioner_id: string;
  last_message: string | null;
  last_message_at: Timestamp | null;
  last_sender_id: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  template_id: string | null;
  assessment_assignment_id: string | null;
  created_at: Timestamp;
  read_at: Timestamp | null;
}

export type PatientRequestStatus = "pending" | "approved" | "declined" | "cancelled";

/** A patient asking to move to another practitioner. Written only by database functions. */
export interface PractitionerChangeRequest {
  id: string;
  patient_id: string;
  patient_name: string;
  from_practitioner_id: string | null;
  from_practitioner_name: string | null;
  /** Empty when the patient left the choice to the clinic. */
  to_practitioner_id: string | null;
  to_practitioner_name: string | null;
  reason: string;
  status: PatientRequestStatus;
  created_at: Timestamp;
  reviewed_by: string | null;
  reviewed_at: Timestamp | null;
}

export type RescheduleStatus = "pending" | "accepted" | "declined" | "cancelled";

/** A patient asking to postpone a session to another free time. */
export interface RescheduleRequest {
  id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  practitioner_id: string;
  practitioner_name: string;
  old_start_at: Timestamp;
  new_start_at: Timestamp;
  reason: string | null;
  status: RescheduleStatus;
  created_at: Timestamp;
  responded_at: Timestamp | null;
}
