"use client";

import {
  conversationId,
  type Appointment,
  type AssessmentAssignment,
  type AssessmentResult,
  type ChatMessage,
  type ClinicalNote,
  type Conversation,
  type MessageTemplate,
  type Patient,
  type PatientStatus,
  type PatientTask,
} from "@chester/shared";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { ScoreChart } from "@/components/ScoreChart";
import { Avatar, Card, Empty, Modal, SeverityBadge, StatusBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument, useQuery, type WithId } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { useForms, usePractitioners, useTemplates } from "@/lib/queries";

type Tab = "progress" | "notes" | "tasks" | "assessments" | "messages" | "sessions";

export default function PatientFilePage() {
  return (
    <Suspense>
      <PatientFile />
    </Suspense>
  );
}

function PatientFile() {
  const params = useSearchParams();
  const patientId = params.get("id") ?? "";
  const { t, formatDate } = useI18n();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "progress");
  const [transferOpen, setTransferOpen] = useState(false);
  const { data: patient, loading } = useDocument<Patient>(patientId ? `patients/${patientId}` : null);
  const { data: practitioners } = usePractitioners();

  const apptQ = useMemo(
    () => (patientId ? query(collection(db, "appointments"), where("patientId", "==", patientId), orderBy("start", "desc")) : null),
    [patientId],
  );
  const { data: appointments } = useQuery<Appointment>(apptQ);

  if (loading) return <p className="muted">{t("loading")}</p>;
  if (!patient) return <Empty />;

  const upcoming = appointments.filter((a) => a.status === "scheduled" && a.end.toMillis() > Date.now());
  const primary = practitioners.find((p) => p.id === patient.primaryPractitionerId);

  return (
    <>
      <Card>
        <div className="row" style={{ flexWrap: "wrap", gap: 20 }}>
          <Avatar name={patient.displayName} large />
          <div className="spacer stack" style={{ gap: 4 }}>
            <h1>{patient.displayName}</h1>
            <div className="small muted" dir="ltr" style={{ textAlign: "start" }}>
              {patient.email}
              {patient.phone ? ` · ${patient.phone}` : ""}
            </div>
            <div className="row small muted">
              {t("primaryPractitioner")}: {primary?.displayName ?? "—"}
            </div>
          </div>
          <select
            className="select"
            style={{ width: "auto" }}
            value={patient.status}
            onChange={(e) => updateDoc(doc(db, "patients", patientId), { status: e.target.value as PatientStatus })}>
            {(["active", "on_hold", "discharged"] as const).map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
          <button className="btn secondary" onClick={() => setTransferOpen(true)}>
            ⇄ {t("transferPatient")}
          </button>
        </div>
        <div className="grid grid-3" style={{ marginTop: 20 }}>
          <MiniStat label={t("sessionsDone")} value={String(patient.completedSessions ?? 0)} />
          <MiniStat label={t("upcomingSessions")} value={String(upcoming.length)} />
          <MiniStat
            label={t("lastSession")}
            value={patient.lastSessionAt ? formatDate(patient.lastSessionAt.toDate()) : "—"}
          />
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "progress", label: t("progress") },
          { value: "notes", label: t("notes") },
          { value: "tasks", label: t("tasks") },
          { value: "assessments", label: t("assessments") },
          { value: "messages", label: t("messages") },
          { value: "sessions", label: t("sessions") },
        ]}
      />

      {tab === "progress" && <ProgressTab patientId={patientId} appointments={appointments} />}
      {tab === "notes" && <NotesTab patientId={patientId} />}
      {tab === "tasks" && <TasksTab patientId={patientId} />}
      {tab === "assessments" && <AssessmentsTab patientId={patientId} patient={patient} />}
      {tab === "messages" && <MessagesTab patientId={patientId} patient={patient} />}
      {tab === "sessions" && <SessionsTab appointments={appointments} />}

      {transferOpen && <TransferModal patientId={patientId} patient={patient} onClose={() => setTransferOpen(false)} />}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 16, background: "var(--surface-raised)" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>{value}</div>
      <div className="small muted">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function useResults(patientId: string) {
  const q = useMemo(
    () => query(collection(db, "assessmentResults"), where("patientId", "==", patientId), orderBy("completedAt", "asc")),
    [patientId],
  );
  return useQuery<AssessmentResult>(q);
}

function ProgressTab({ patientId, appointments }: { patientId: string; appointments: WithId<Appointment>[] }) {
  const { t } = useI18n();
  const { data: results } = useResults(patientId);
  const { data: forms } = useForms();

  const byForm = new Map<string, WithId<AssessmentResult>[]>();
  for (const r of results) byForm.set(r.formId, [...(byForm.get(r.formId) ?? []), r]);

  const counts = {
    completed: appointments.filter((a) => a.status === "completed").length,
    no_show: appointments.filter((a) => a.status === "no_show").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  return (
    <div className="grid grid-2">
      <Card title={t("scoreOverTime")} className="stack">
        {byForm.size === 0 && <Empty text={t("noScores")} />}
        {[...byForm.entries()].map(([formId, rs]) => {
          const form = forms.find((f) => f.id === formId);
          return (
            <ScoreChart
              key={formId}
              title={form?.code ?? rs[0].formCode}
              results={rs}
              maxScore={rs[0].maxScore}
              bands={form?.bands ?? []}
            />
          );
        })}
      </Card>
      <Card title={t("sessions")}>
        {(["completed", "no_show", "cancelled"] as const).map((s) => (
          <div key={s} className="list-item">
            <StatusBadge status={s} />
            <span className="spacer" />
            <strong>{counts[s]}</strong>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NotesTab({ patientId }: { patientId: string }) {
  const { user, profile } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const q = useMemo(() => query(collection(db, "patients", patientId, "notes"), orderBy("createdAt", "desc")), [patientId]);
  const { data: notes } = useQuery<ClinicalNote>(q);
  const [body, setBody] = useState("");

  async function add() {
    if (!body.trim() || !user) return;
    await addDoc(collection(db, "patients", patientId, "notes"), {
      authorId: user.uid,
      authorName: profile?.displayName ?? user.email,
      body: body.trim(),
      createdAt: serverTimestamp(),
    });
    setBody("");
  }

  return (
    <Card>
      <div className="stack">
        <p className="small muted">🔒 {t("notesPrivate")}</p>
        <textarea className="textarea" placeholder={t("newNote")} value={body} onChange={(e) => setBody(e.target.value)} />
        <div>
          <button className="btn" onClick={add} disabled={!body.trim()}>
            {t("addNote")}
          </button>
        </div>
        {notes.length === 0 && <Empty />}
        {notes.map((n) => (
          <div key={n.id} className="card" style={{ background: "var(--surface-raised)", padding: 16 }}>
            <div className="row small muted" style={{ marginBottom: 6 }}>
              <strong style={{ color: "var(--text)" }}>{n.authorName}</strong>
              <span>
                {n.createdAt ? `${formatDate(n.createdAt.toDate())} · ${formatTime(n.createdAt.toDate())}` : ""}
              </span>
              <span className="spacer" />
              {n.authorId === user?.uid && (
                <button className="btn ghost small" onClick={() => deleteDoc(doc(db, "patients", patientId, "notes", n.id))}>
                  {t("delete")}
                </button>
              )}
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TasksTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const q = useMemo(() => query(collection(db, "patients", patientId, "tasks"), orderBy("createdAt", "desc")), [patientId]);
  const { data: tasks } = useQuery<PatientTask>(q);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function add() {
    if (!title.trim() || !user) return;
    await addDoc(collection(db, "patients", patientId, "tasks"), {
      authorId: user.uid,
      title: title.trim(),
      done: false,
      ...(dueDate ? { dueDate } : {}),
      createdAt: serverTimestamp(),
    });
    setTitle("");
    setDueDate("");
  }

  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Card>
      <div className="stack">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <input
            className="input spacer"
            placeholder={t("newTask")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <input className="input" type="date" style={{ width: 170 }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t("dueDate")} />
          <button className="btn" onClick={add} disabled={!title.trim()}>
            {t("add")}
          </button>
        </div>
        {sorted.length === 0 && <Empty />}
        {sorted.map((task) => (
          <div key={task.id} className="list-item">
            <label className="checkbox spacer">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => updateDoc(doc(db, "patients", patientId, "tasks", task.id), { done: !task.done })}
              />
              <span className={task.done ? "done" : ""}>{task.title}</span>
            </label>
            {task.dueDate && <span className="badge neutral">{task.dueDate}</span>}
            <button className="btn ghost small" onClick={() => deleteDoc(doc(db, "patients", patientId, "tasks", task.id))}>
              {t("delete")}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Creates the assignment and posts it in the chat so the patient can open it from the app. */
async function sendAssessment(opts: {
  patientId: string;
  patientName: string;
  practitionerId: string;
  formId: string;
  formCode: string;
  formTitle: string;
  text: string;
  templateId?: string;
}) {
  const batch = writeBatch(db);
  const assignmentRef = doc(collection(db, "assessmentAssignments"));
  batch.set(assignmentRef, {
    patientId: opts.patientId,
    patientName: opts.patientName,
    practitionerId: opts.practitionerId,
    formId: opts.formId,
    formCode: opts.formCode,
    formTitle: opts.formTitle,
    status: "sent",
    sentAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "conversations", conversationId(opts.patientId, opts.practitionerId), "messages")), {
    senderId: opts.practitionerId,
    text: opts.text,
    assessmentAssignmentId: assignmentRef.id,
    ...(opts.templateId ? { templateId: opts.templateId } : {}),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

function AssessmentsTab({ patientId, patient }: { patientId: string; patient: Patient }) {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { data: forms } = useForms();
  const { data: results } = useResults(patientId);
  const q = useMemo(
    () => query(collection(db, "assessmentAssignments"), where("patientId", "==", patientId), orderBy("sentAt", "desc")),
    [patientId],
  );
  const { data: assignments } = useQuery<AssessmentAssignment>(q);
  const [formId, setFormId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const form = forms.find((f) => f.id === formId);
    if (!form || !user) return;
    setError(null);
    try {
      await sendAssessment({
        patientId,
        patientName: patient.displayName,
        practitionerId: user.uid,
        formId: form.id,
        formCode: form.code,
        formTitle: form.title,
        text: form.instructions,
      });
      setFormId("");
    } catch {
      setError(t("error"));
    }
  }

  return (
    <Card>
      <div className="stack">
        <div className="row">
          <select className="select spacer" value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">{t("form")}…</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} · {f.title}
              </option>
            ))}
          </select>
          <button className="btn" onClick={send} disabled={!formId}>
            {t("sendAssessment")}
          </button>
        </div>
        {error && <div className="alert small">{error}</div>}
        {assignments.length === 0 && <Empty />}
        <table className="table">
          <tbody>
            {assignments.map((a) => {
              const r = results.find((x) => x.id === a.id);
              return (
                <tr key={a.id}>
                  <td>
                    <strong>{a.formCode}</strong>
                  </td>
                  <td className="small muted">
                    {t("sent")} {a.sentAt ? formatDate(a.sentAt.toDate()) : ""}
                  </td>
                  <td>
                    {r ? (
                      <div className="row">
                        <span>
                          {t("score")} <strong>{r.score}</strong>/{r.maxScore}
                        </span>
                        <SeverityBadge level={r.severityLevel} label={r.severity} />
                        {r.safetyFlag && <span className="badge danger">⚠ {t("safetyAlerts")}</span>}
                      </div>
                    ) : (
                      <span className="badge warning">{t("waitingForPatient")}</span>
                    )}
                  </td>
                  <td>
                    {r &&
                      (r.reviewed ? (
                        <span className="badge success">{t("reviewed")}</span>
                      ) : (
                        <button className="btn secondary small" onClick={() => updateDoc(doc(db, "assessmentResults", r.id), { reviewed: true })}>
                          {t("markReviewed")}
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MessagesTab({ patientId, patient }: { patientId: string; patient: Patient }) {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const cid = user ? conversationId(patientId, user.uid) : null;
  const { data: convo, loading } = useDocument<Conversation>(cid ? `conversations/${cid}` : null);
  const q = useMemo(
    () => (cid && convo ? query(collection(db, "conversations", cid, "messages"), orderBy("createdAt", "asc")) : null),
    [cid, convo],
  );
  const { data: messages } = useQuery<ChatMessage>(q);
  const { data: templates } = useTemplates(user?.uid);
  const { data: forms } = useForms();
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");

  if (loading) return null;
  // The conversation is opened when the patient books with you or you accept a transfer.
  if (!convo || !cid || !user) return <Card><Empty /></Card>;

  async function send() {
    if (!user || !cid) return;
    const template = templates.find((x) => x.id === templateId) as WithId<MessageTemplate> | undefined;
    const body = text.trim();
    if (!body) return;
    if (template?.kind === "assessment" && template.formId) {
      const form = forms.find((f) => f.id === template.formId);
      if (!form) return;
      await sendAssessment({
        patientId,
        patientName: patient.displayName,
        practitionerId: user.uid,
        formId: form.id,
        formCode: form.code,
        formTitle: form.title,
        text: body,
        templateId: template.id,
      });
    } else {
      await addDoc(collection(db, "conversations", cid, "messages"), {
        senderId: user.uid,
        text: body,
        ...(template ? { templateId: template.id } : {}),
        createdAt: serverTimestamp(),
      });
    }
    setText("");
    setTemplateId("");
  }

  return (
    <Card>
      <div className="stack">
        <div className="chat-log">
          {messages.length === 0 && <Empty />}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.senderId === user.uid ? "mine" : "theirs"}`}>
              {m.text}
              {m.assessmentAssignmentId && <div className="small">📋 {t("assessmentTemplate")}</div>}
              <div className="small" style={{ opacity: 0.7 }}>
                {m.createdAt ? `${formatDate(m.createdAt.toDate())} ${formatTime(m.createdAt.toDate())}` : ""}
              </div>
            </div>
          ))}
        </div>
        <select
          className="select"
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            const tpl = templates.find((x) => x.id === e.target.value);
            if (tpl) setText(tpl.body);
          }}>
          <option value="">{t("sendTemplate")}…</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.kind === "assessment" ? "📋 " : "✉ "}
              {tpl.title}
            </option>
          ))}
        </select>
        <textarea className="textarea" placeholder={t("writeMessage")} value={text} onChange={(e) => setText(e.target.value)} />
        <div>
          <button className="btn" onClick={send} disabled={!text.trim()}>
            {t("send")}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function SessionsTab({ appointments }: { appointments: WithId<Appointment>[] }) {
  const { t, formatDate, formatTime } = useI18n();
  return (
    <Card>
      {appointments.length === 0 ? (
        <Empty />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("time")}</th>
              <th>{t("practitioner")}</th>
              <th>{t("mode")}</th>
              <th>{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{formatDate(a.start.toDate())}</td>
                <td>{formatTime(a.start.toDate())}</td>
                <td>{a.practitionerName}</td>
                <td>{t(a.mode)}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TransferModal({ patientId, patient, onClose }: { patientId: string; patient: Patient; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { t, locale } = useI18n();
  const { data: practitioners } = usePractitioners();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [keepAccess, setKeepAccess] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = practitioners.filter((p) => p.id !== user?.uid);
  const target = others.find((p) => p.id === to);

  async function submit() {
    if (!user || !target) return;
    try {
      await addDoc(collection(db, "transfers"), {
        patientId,
        patientName: patient.displayName,
        fromPractitionerId: user.uid,
        fromPractitionerName: profile?.displayName ?? user.email,
        toPractitionerId: target.id,
        toPractitionerName: target.displayName,
        reason: reason.trim(),
        keepAccess,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setDone(true);
    } catch {
      setError(t("error"));
    }
  }

  return (
    <Modal title={t("transferPatient")} onClose={onClose}>
      {done ? (
        <div className="stack">
          <div className="notice">{t("transferSent")}</div>
          <button className="btn" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      ) : (
        <div className="stack">
          <label className="label">
            {t("transferTo")}
            <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">—</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {(locale === "ar" && p.displayNameAr) || p.displayName} · {t(p.discipline)}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            {t("transferReason")}
            <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={keepAccess} onChange={(e) => setKeepAccess(e.target.checked)} />
            {t("keepAccess")}
          </label>
          {error && <div className="alert small">{error}</div>}
          <button className="btn" onClick={submit} disabled={!to || !reason.trim()}>
            {t("transferPatient")}
          </button>
        </div>
      )}
    </Modal>
  );
}
