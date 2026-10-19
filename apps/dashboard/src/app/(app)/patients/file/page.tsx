"use client";

import type {
  Appointment,
  AssessmentAssignment,
  AssessmentResult,
  ChatMessage,
  ClinicalNote,
  Conversation,
  Patient,
  PatientStatus,
  PatientTask,
} from "@chester/shared";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ScoreChart } from "@/components/ScoreChart";
import { Avatar, Card, Empty, Modal, SeverityBadge, StatusBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLive, useRows } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { useForms, usePractitioners, useTemplates } from "@/lib/queries";
import { must, rpc, supabase } from "@/lib/supabase";

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
  const { data: patient, loading } = useLive<Patient>(
    patientId ? `patient:${patientId}` : null,
    () => supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
    ["patients"],
  );
  const { data: practitioners } = usePractitioners();
  const { data: appointments } = useRows<Appointment>(
    patientId ? `patient-appointments:${patientId}` : null,
    () =>
      supabase.from("appointments").select("*").eq("patient_id", patientId).order("start_at", { ascending: false }),
    ["appointments"],
  );

  if (loading) return <p className="muted">{t("loading")}</p>;
  if (!patient) return <Empty />;

  const upcoming = appointments.filter((a) => a.status === "scheduled" && Date.parse(a.end_at) > Date.now());
  const primary = practitioners.find((p) => p.id === patient.primary_practitioner_id);

  return (
    <>
      <Card>
        <div className="row" style={{ flexWrap: "wrap", gap: 20 }}>
          <Avatar name={patient.display_name} large />
          <div className="spacer stack" style={{ gap: 4 }}>
            <h1>{patient.display_name}</h1>
            <div className="small muted" dir="ltr" style={{ textAlign: "start" }}>
              {patient.email}
              {patient.phone ? ` · ${patient.phone}` : ""}
            </div>
            <div className="row small muted">
              {t("primaryPractitioner")}: {primary?.display_name ?? "—"}
            </div>
          </div>
          <select
            className="select"
            style={{ width: "auto" }}
            value={patient.status}
            onChange={(e) =>
              must(
                supabase.from("patients").update({ status: e.target.value as PatientStatus }).eq("id", patientId),
              ).catch(console.error)
            }>
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
          <MiniStat label={t("sessionsDone")} value={String(patient.completed_sessions ?? 0)} />
          <MiniStat label={t("upcomingSessions")} value={String(upcoming.length)} />
          <MiniStat
            label={t("lastSession")}
            value={patient.last_session_at ? formatDate(patient.last_session_at) : "—"}
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
      {tab === "assessments" && <AssessmentsTab patientId={patientId} />}
      {tab === "messages" && <MessagesTab patientId={patientId} />}
      {tab === "sessions" && <SessionsTab appointments={appointments} />}

      {transferOpen && <TransferModal patientId={patientId} onClose={() => setTransferOpen(false)} />}
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
  return useRows<AssessmentResult>(
    `patient-results:${patientId}`,
    () => supabase.from("assessment_results").select("*").eq("patient_id", patientId).order("completed_at"),
    ["assessment_results"],
  );
}

/** This practitioner's conversation with the patient, opened by booking or an accepted transfer. */
function useConversation(patientId: string, practitionerId: string | undefined) {
  return useLive<Conversation>(
    practitionerId ? `conversation:${patientId}:${practitionerId}` : null,
    () =>
      supabase
        .from("conversations")
        .select("*")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId!)
        .maybeSingle(),
    ["conversations"],
  );
}

function ProgressTab({ patientId, appointments }: { patientId: string; appointments: Appointment[] }) {
  const { t } = useI18n();
  const { data: results } = useResults(patientId);
  const { data: forms } = useForms();

  const byForm = new Map<string, AssessmentResult[]>();
  for (const r of results) byForm.set(r.form_id, [...(byForm.get(r.form_id) ?? []), r]);

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
              title={form?.code ?? rs[0].form_code}
              results={rs}
              maxScore={rs[0].max_score}
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
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const { data: notes } = useRows<ClinicalNote>(
    `notes:${patientId}`,
    () => supabase.from("notes").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    ["notes"],
  );
  const [body, setBody] = useState("");

  async function add() {
    if (!body.trim() || !user) return;
    // The author and their name are filled in by the database.
    await must(supabase.from("notes").insert({ patient_id: patientId, body: body.trim() }));
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
              <strong style={{ color: "var(--text)" }}>{n.author_name}</strong>
              <span>{`${formatDate(n.created_at)} · ${formatTime(n.created_at)}`}</span>
              <span className="spacer" />
              {n.author_id === user?.id && (
                <button
                  className="btn ghost small"
                  onClick={() => must(supabase.from("notes").delete().eq("id", n.id)).catch(console.error)}>
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
  const { data: tasks } = useRows<PatientTask>(
    `tasks:${patientId}`,
    () => supabase.from("tasks").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
    ["tasks"],
  );
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function add() {
    if (!title.trim() || !user) return;
    await must(supabase.from("tasks").insert({ patient_id: patientId, title: title.trim(), due_date: dueDate || null }));
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
                onChange={() =>
                  must(supabase.from("tasks").update({ done: !task.done }).eq("id", task.id)).catch(console.error)
                }
              />
              <span className={task.done ? "done" : ""}>{task.title}</span>
            </label>
            {task.due_date && <span className="badge neutral">{task.due_date}</span>}
            <button
              className="btn ghost small"
              onClick={() => must(supabase.from("tasks").delete().eq("id", task.id)).catch(console.error)}>
              {t("delete")}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Creates the assignment and posts it in the chat, in one step, so the patient can open it from the app. */
async function sendAssessment(opts: { patientId: string; formId: string; text: string; templateId?: string }) {
  await rpc<string>("send_assessment", {
    p_patient: opts.patientId,
    p_form: opts.formId,
    p_text: opts.text,
    p_template: opts.templateId ?? null,
  });
}

function AssessmentsTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { data: forms } = useForms();
  const { data: results } = useResults(patientId);
  const { data: convo, loading: convoLoading } = useConversation(patientId, user?.id);
  const { data: assignments } = useRows<AssessmentAssignment>(
    `assignments:${patientId}`,
    () =>
      supabase
        .from("assessment_assignments")
        .select("*")
        .eq("patient_id", patientId)
        .order("sent_at", { ascending: false }),
    ["assessment_assignments"],
  );
  const [formId, setFormId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const form = forms.find((f) => f.id === formId);
    if (!form || !user || !convo) return;
    setError(null);
    try {
      await sendAssessment({ patientId, formId: form.id, text: form.instructions });
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
          <button className="btn" onClick={send} disabled={!formId || !convo}>
            {t("sendAssessment")}
          </button>
        </div>
        {/* The form is delivered as a chat message, so it needs a conversation with this patient. */}
        {!convoLoading && !convo && <div className="notice small">{t("noConversation")}</div>}
        {error && <div className="alert small">{error}</div>}
        {assignments.length === 0 && <Empty />}
        <table className="table">
          <tbody>
            {assignments.map((a) => {
              const r = results.find((x) => x.assignment_id === a.id);
              return (
                <tr key={a.id}>
                  <td>
                    <strong>{a.form_code}</strong>
                  </td>
                  <td className="small muted">
                    {t("sent")} {formatDate(a.sent_at)}
                  </td>
                  <td>
                    {r ? (
                      <div className="row">
                        <span>
                          {t("score")} <strong>{r.score}</strong>/{r.max_score}
                        </span>
                        <SeverityBadge level={r.severity_level} label={r.severity} />
                        {r.safety_flag && <span className="badge danger">⚠ {t("safetyAlerts")}</span>}
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
                        <button
                          className="btn secondary small"
                          onClick={() =>
                            must(
                              supabase.from("assessment_results").update({ reviewed: true }).eq("assignment_id", r.assignment_id),
                            ).catch(console.error)
                          }>
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

function MessagesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const { data: convo, loading } = useConversation(patientId, user?.id);
  const cid = convo?.id ?? null;
  const { data: messages } = useRows<ChatMessage>(
    cid ? `messages:${cid}` : null,
    () => supabase.from("messages").select("*").eq("conversation_id", cid!).order("created_at"),
    ["messages"],
  );
  const { data: templates } = useTemplates(user?.id);
  const { data: forms } = useForms();
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");

  if (loading) return null;
  // The conversation is opened when the patient books with you or you accept a transfer.
  if (!convo || !cid || !user) return <Card><Empty text={t("noConversation")} /></Card>;

  async function send() {
    if (!user || !cid) return;
    const template = templates.find((x) => x.id === templateId);
    const body = text.trim();
    if (!body) return;
    if (template?.kind === "assessment" && template.form_id) {
      const form = forms.find((f) => f.id === template.form_id);
      if (!form) return;
      await sendAssessment({ patientId, formId: form.id, text: body, templateId: template.id });
    } else {
      await must(
        supabase.from("messages").insert({ conversation_id: cid, text: body, template_id: template?.id ?? null }),
      );
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
            <div key={m.id} className={`bubble ${m.sender_id === user.id ? "mine" : "theirs"}`}>
              {m.text}
              {m.assessment_assignment_id && <div className="small">📋 {t("assessmentTemplate")}</div>}
              <div className="small" style={{ opacity: 0.7 }}>
                {`${formatDate(m.created_at)} ${formatTime(m.created_at)}`}
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

function SessionsTab({ appointments }: { appointments: Appointment[] }) {
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
                <td>{formatDate(a.start_at)}</td>
                <td>{formatTime(a.start_at)}</td>
                <td>{a.practitioner_name}</td>
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

function TransferModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { data: practitioners } = usePractitioners();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [keepAccess, setKeepAccess] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = practitioners.filter((p) => p.id !== user?.id);
  const target = others.find((p) => p.id === to);

  async function submit() {
    if (!user || !target) return;
    try {
      // The sender and everyone's names are filled in by the database.
      await must(
        supabase.from("transfers").insert({
          patient_id: patientId,
          to_practitioner_id: target.id,
          reason: reason.trim(),
          keep_access: keepAccess,
        }),
      );
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
                  {(locale === "ar" && p.display_name_ar) || p.display_name} · {t(p.discipline)}
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
