"use client";

import type { Locale } from "@chester/shared";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Every visible string in the dashboard lives here, in English and Arabic.
// Add a key to `en` first; TypeScript then requires the Arabic entry.

const en = {
  appName: "New Chester Clinic",
  practitionerPortal: "Practitioner portal",
  language: "العربية",
  signIn: "Sign in",
  signOut: "Sign out",
  email: "Email",
  password: "Password",
  forgotPassword: "Forgot password?",
  resetSent: "If that email has an account, a reset link is on its way.",
  wrongCredentials: "Email or password is incorrect.",
  notStaff: "This account doesn't have access to the practitioner portal.",
  newPassword: "New password",
  savePassword: "Save password",
  passwordSaved: "Password changed. You can sign in with it now, here or in the patient app.",
  passwordTooShort: "Use at least 8 characters.",
  loading: "Loading…",
  save: "Save",
  saved: "Saved",
  cancel: "Cancel",
  send: "Send",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  close: "Close",
  confirm: "Confirm",
  search: "Search",
  none: "Nothing here yet.",
  error: "Something went wrong. Please try again.",

  navOverview: "Overview",
  navAppointments: "Appointments",
  navPatients: "Patient files",
  navTransfers: "Transfers",
  navAvailability: "Availability",
  navTemplates: "Templates",
  navAssessments: "Assessments",
  navTeam: "Team",

  goodMorning: "Good morning",
  goodAfternoon: "Good afternoon",
  goodEvening: "Good evening",
  todaySessions: "Today's sessions",
  upcomingSessions: "Upcoming sessions",
  pendingTransfers: "Transfers waiting for you",
  newResults: "New assessment results",
  safetyAlerts: "Safety alerts",
  safetyAlertHelp: "A patient answered a self-harm question above zero. Follow up today.",
  openTasks: "Open to-dos",
  noSessionsToday: "No sessions today.",

  upcoming: "Upcoming",
  past: "Past",
  all: "All",
  date: "Date",
  time: "Time",
  patient: "Patient",
  practitioner: "Practitioner",
  mode: "Type",
  status: "Status",
  actions: "Actions",
  video: "Video",
  audio: "Voice",
  chat: "Chat",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  markCompleted: "Mark completed",
  markNoShow: "Mark no-show",
  cancelSession: "Cancel session",
  meetingLink: "Meeting link",
  meetingLinkHelp: "Paste the video link the patient should open (Zoom, Meet, etc.).",
  openFile: "Open file",

  searchPatients: "Search patients by name or email",
  sessionsDone: "Sessions done",
  lastSession: "Last session",
  primaryPractitioner: "Main practitioner",
  active: "Active",
  on_hold: "On hold",
  discharged: "Discharged",
  progress: "Progress",
  notes: "Notes",
  tasks: "To-do list",
  assessments: "Assessments",
  messages: "Messages",
  sessions: "Sessions",
  newNote: "Write a note about this patient…",
  addNote: "Add note",
  notesPrivate: "Notes are only visible to the care team, never to the patient.",
  newTask: "Add a to-do for this patient…",
  dueDate: "Due date",
  transferPatient: "Transfer patient",
  sendAssessment: "Send assessment",
  sendTemplate: "Send template",
  writeMessage: "Write a message…",
  noConversation: "You can message this patient once they book a session with you or you accept their transfer.",
  scoreOverTime: "Scores over time",
  noScores: "No completed assessments yet.",
  score: "Score",
  severity: "Severity",
  sent: "Sent",
  waitingForPatient: "Waiting for patient",
  markReviewed: "Mark reviewed",
  reviewed: "Reviewed",

  transferTo: "Transfer to",
  transferReason: "Reason for transfer",
  keepAccess: "Keep my access to this patient's file",
  transferSent: "Transfer request sent.",
  incoming: "Incoming",
  outgoing: "Outgoing",
  accept: "Accept",
  decline: "Decline",
  withdraw: "Withdraw",
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  from: "From",
  to: "To",
  reason: "Reason",

  myRequests: "My requests",
  newRequest: "New request",
  notAvailable: "I won't see patients",
  availableExtra: "I'm available",
  fromDate: "From",
  toDate: "To",
  hoursFrom: "Hours from",
  hoursTo: "Hours to",
  note: "Note",
  submitRequest: "Send request",
  approved: "Approved",
  rejected: "Rejected",
  approve: "Approve",
  reject: "Reject",
  requestsToReview: "Requests to review",
  affectedSessions: "sessions already booked in this period need to be moved.",
  weeklyHours: "Weekly hours",
  weeklyHoursHelp: "Patients can book inside these hours. Leave a day empty if you don't work that day.",
  sessionLength: "Session length (minutes)",
  timeZone: "Time zone",
  thisWeek: "This week",
  nextWeek: "Next week",

  newTemplate: "New template",
  title: "Title",
  body: "Message",
  kind: "Type",
  messageTemplate: "Message",
  assessmentTemplate: "Assessment link",
  form: "Form",
  sharedTemplate: "Clinic template",
  myTemplate: "My template",
  templateLanguage: "Language",
  english: "English",
  arabic: "Arabic",

  flaggedFirst: "Flagged and unreviewed results are shown first.",

  addPractitioner: "Add practitioner",
  name: "Full name",
  discipline: "Discipline",
  psychiatry: "Psychiatry",
  psychology: "Psychology",
  jobTitle: "Job title",
  makeAdmin: "Also make them an admin",
  inviteFirst:
    "The person needs an account first. Invite them from the Supabase dashboard (Authentication > Users > Invite user), or ask them to sign up, then add them here with the same email.",
  practitionerAdded: "Added. They can now sign in to the practitioner portal.",

  sev0: "Minimal",
  sev1: "Mild",
  sev2: "Moderate",
  sev3: "Moderately severe",
  sev4: "Severe",

  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

export type MessageKey = keyof typeof en;

const ar: Record<MessageKey, string> = {
  appName: "عيادة نيو تشستر",
  practitionerPortal: "بوابة الأخصائيين",
  language: "English",
  signIn: "تسجيل الدخول",
  signOut: "تسجيل الخروج",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  forgotPassword: "نسيت كلمة المرور؟",
  resetSent: "إذا كان هذا البريد مسجلاً، فسيصلك رابط لإعادة التعيين.",
  wrongCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  notStaff: "هذا الحساب ليس لديه صلاحية الدخول إلى بوابة الأخصائيين.",
  newPassword: "كلمة المرور الجديدة",
  savePassword: "حفظ كلمة المرور",
  passwordSaved: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول بها الآن، هنا أو في تطبيق المرضى.",
  passwordTooShort: "استخدم 8 أحرف على الأقل.",
  loading: "جارٍ التحميل…",
  save: "حفظ",
  saved: "تم الحفظ",
  cancel: "إلغاء",
  send: "إرسال",
  delete: "حذف",
  edit: "تعديل",
  add: "إضافة",
  close: "إغلاق",
  confirm: "تأكيد",
  search: "بحث",
  none: "لا يوجد شيء بعد.",
  error: "حدث خطأ. حاول مرة أخرى.",

  navOverview: "نظرة عامة",
  navAppointments: "المواعيد",
  navPatients: "ملفات المرضى",
  navTransfers: "التحويلات",
  navAvailability: "التوفر",
  navTemplates: "القوالب",
  navAssessments: "التقييمات",
  navTeam: "الفريق",

  goodMorning: "صباح الخير",
  goodAfternoon: "مساء الخير",
  goodEvening: "مساء الخير",
  todaySessions: "جلسات اليوم",
  upcomingSessions: "الجلسات القادمة",
  pendingTransfers: "تحويلات بانتظارك",
  newResults: "نتائج تقييم جديدة",
  safetyAlerts: "تنبيهات السلامة",
  safetyAlertHelp: "أجاب مريض على سؤال إيذاء النفس بأكثر من صفر. تابع معه اليوم.",
  openTasks: "مهام مفتوحة",
  noSessionsToday: "لا توجد جلسات اليوم.",

  upcoming: "القادمة",
  past: "السابقة",
  all: "الكل",
  date: "التاريخ",
  time: "الوقت",
  patient: "المريض",
  practitioner: "الأخصائي",
  mode: "النوع",
  status: "الحالة",
  actions: "الإجراءات",
  video: "فيديو",
  audio: "صوت",
  chat: "محادثة",
  scheduled: "مجدولة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  no_show: "لم يحضر",
  markCompleted: "تحديد كمكتملة",
  markNoShow: "تحديد كغياب",
  cancelSession: "إلغاء الجلسة",
  meetingLink: "رابط الجلسة",
  meetingLinkHelp: "الصق رابط الفيديو الذي سيفتحه المريض (Zoom أو Meet أو غيرهما).",
  openFile: "فتح الملف",

  searchPatients: "ابحث عن مريض بالاسم أو البريد",
  sessionsDone: "الجلسات المكتملة",
  lastSession: "آخر جلسة",
  primaryPractitioner: "الأخصائي المعالج",
  active: "نشط",
  on_hold: "متوقف مؤقتاً",
  discharged: "منتهي العلاج",
  progress: "التقدم",
  notes: "الملاحظات",
  tasks: "قائمة المهام",
  assessments: "التقييمات",
  messages: "الرسائل",
  sessions: "الجلسات",
  newNote: "اكتب ملاحظة عن هذا المريض…",
  addNote: "إضافة ملاحظة",
  notesPrivate: "الملاحظات يراها الفريق المعالج فقط، ولا تظهر للمريض أبداً.",
  newTask: "أضف مهمة لهذا المريض…",
  dueDate: "تاريخ الاستحقاق",
  transferPatient: "تحويل المريض",
  sendAssessment: "إرسال تقييم",
  sendTemplate: "إرسال قالب",
  writeMessage: "اكتب رسالة…",
  noConversation: "يمكنك مراسلة هذا المريض بعد أن يحجز جلسة معك أو بعد قبولك تحويله إليك.",
  scoreOverTime: "الدرجات مع الوقت",
  noScores: "لا توجد تقييمات مكتملة بعد.",
  score: "الدرجة",
  severity: "الشدة",
  sent: "أُرسل",
  waitingForPatient: "بانتظار المريض",
  markReviewed: "تحديد كمراجَع",
  reviewed: "تمت المراجعة",

  transferTo: "تحويل إلى",
  transferReason: "سبب التحويل",
  keepAccess: "احتفظ بصلاحية الاطلاع على ملف المريض",
  transferSent: "تم إرسال طلب التحويل.",
  incoming: "الواردة",
  outgoing: "الصادرة",
  accept: "قبول",
  decline: "رفض",
  withdraw: "سحب",
  pending: "قيد الانتظار",
  accepted: "مقبول",
  declined: "مرفوض",
  from: "من",
  to: "إلى",
  reason: "السبب",

  myRequests: "طلباتي",
  newRequest: "طلب جديد",
  notAvailable: "لن أستقبل مرضى",
  availableExtra: "أنا متاح",
  fromDate: "من",
  toDate: "إلى",
  hoursFrom: "من الساعة",
  hoursTo: "إلى الساعة",
  note: "ملاحظة",
  submitRequest: "إرسال الطلب",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  approve: "موافقة",
  reject: "رفض",
  requestsToReview: "طلبات بانتظار المراجعة",
  affectedSessions: "جلسات محجوزة في هذه الفترة تحتاج إلى نقل.",
  weeklyHours: "ساعات العمل الأسبوعية",
  weeklyHoursHelp: "يمكن للمرضى الحجز ضمن هذه الساعات. اترك اليوم فارغاً إذا كنت لا تعمل فيه.",
  sessionLength: "مدة الجلسة (بالدقائق)",
  timeZone: "المنطقة الزمنية",
  thisWeek: "هذا الأسبوع",
  nextWeek: "الأسبوع القادم",

  newTemplate: "قالب جديد",
  title: "العنوان",
  body: "الرسالة",
  kind: "النوع",
  messageTemplate: "رسالة",
  assessmentTemplate: "رابط تقييم",
  form: "النموذج",
  sharedTemplate: "قالب العيادة",
  myTemplate: "قالبي",
  templateLanguage: "اللغة",
  english: "الإنجليزية",
  arabic: "العربية",

  flaggedFirst: "تظهر النتائج المنبّهة وغير المراجَعة أولاً.",

  addPractitioner: "إضافة أخصائي",
  name: "الاسم الكامل",
  discipline: "التخصص",
  psychiatry: "الطب النفسي",
  psychology: "علم النفس",
  jobTitle: "المسمى الوظيفي",
  makeAdmin: "اجعله مشرفاً أيضاً",
  inviteFirst:
    "يجب أن يكون لدى الشخص حساب أولاً. ادعه من لوحة تحكم Supabase (Authentication > Users > Invite user)، أو اطلب منه إنشاء حساب، ثم أضفه هنا بالبريد الإلكتروني نفسه.",
  practitionerAdded: "تمت الإضافة. يمكنه الآن تسجيل الدخول إلى بوابة الأخصائيين.",

  sev0: "طفيف",
  sev1: "خفيف",
  sev2: "متوسط",
  sev3: "متوسط إلى شديد",
  sev4: "شديد",

  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
  sat: "السبت",
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ar };

interface I18n {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: MessageKey) => string;
  setLocale: (l: Locale) => void;
  /** Accepts a Date or an ISO timestamp string from the database. */
  formatDate: (d: Date | string) => string;
  formatTime: (d: Date | string) => string;
  formatShortDate: (d: Date | string) => string;
  /** Severity band name for a level 0–4, falling back to the stored English label. */
  severityLabel: (level: number, fallback: string) => string;
}

const asDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

const I18nContext = createContext<I18n | null>(null);
const STORAGE_KEY = "chester.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLocaleState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  // Arabic UI with Latin digits reads best for times and phone numbers in the Gulf.
  const intl = locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB";
  const value: I18n = {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    t: (key) => dictionaries[locale][key],
    setLocale,
    formatDate: (d) =>
      asDate(d).toLocaleDateString(intl, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    formatTime: (d) => asDate(d).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" }),
    formatShortDate: (d) => asDate(d).toLocaleDateString(intl, { day: "numeric", month: "short" }),
    severityLabel: (level, fallback) =>
      level >= 0 && level <= 4 ? dictionaries[locale][`sev${level}` as MessageKey] : fallback,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
