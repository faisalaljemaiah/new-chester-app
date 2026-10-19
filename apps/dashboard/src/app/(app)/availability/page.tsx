"use client";

import type { AvailabilityKind, Practitioner, WeeklyHours } from "@chester/shared";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { Card, Empty, StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, db } from "@/lib/firebase";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useMyAvailabilityRequests, usePendingAvailabilityRequests } from "@/lib/queries";

const DAY_KEYS: MessageKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Sunday-to-Saturday week containing the given date, offset by whole weeks. */
function weekRange(offsetWeeks: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offsetWeeks * 7));
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { from: iso(start), to: iso(end) };
}

export default function AvailabilityPage() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  return (
    <>
      <div className="page-header">
        <h1>{t("navAvailability")}</h1>
      </div>
      {isAdmin && <ReviewQueue />}
      <div className="grid grid-2">
        <NewRequest />
        <MyRequests />
      </div>
      <WeeklyHoursEditor />
    </>
  );
}

function NewRequest() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [kind, setKind] = useState<AvailabilityKind>("unavailable");
  const [range, setRange] = useState(weekRange(0));
  const [hours, setHours] = useState({ start: "09:00", end: "17:00" });
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!user) return;
    await addDoc(collection(db, "availabilityRequests"), {
      practitionerId: user.uid,
      practitionerName: profile?.displayName ?? user.email,
      kind,
      from: range.from,
      to: range.to,
      ...(kind === "available" ? { hours } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      status: "pending",
      createdAt: serverTimestamp(),
    });
    setNote("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <Card title={t("newRequest")}>
      <div className="stack">
        <div className="row">
          {(["unavailable", "available"] as const).map((k) => (
            <button key={k} className={`btn ${kind === k ? "" : "secondary"}`} onClick={() => setKind(k)}>
              {k === "unavailable" ? t("notAvailable") : t("availableExtra")}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn ghost small" onClick={() => setRange(weekRange(0))}>
            {t("thisWeek")}
          </button>
          <button className="btn ghost small" onClick={() => setRange(weekRange(1))}>
            {t("nextWeek")}
          </button>
        </div>
        <div className="grid grid-2">
          <label className="label">
            {t("fromDate")}
            <input className="input" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="label">
            {t("toDate")}
            <input className="input" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
        </div>
        {kind === "available" && (
          <div className="grid grid-2">
            <label className="label">
              {t("hoursFrom")}
              <input className="input" type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} />
            </label>
            <label className="label">
              {t("hoursTo")}
              <input className="input" type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} />
            </label>
          </div>
        )}
        <label className="label">
          {t("note")}
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="btn" onClick={submit} disabled={!range.from || !range.to || range.from > range.to}>
          {sent ? `✓ ${t("saved")}` : t("submitRequest")}
        </button>
      </div>
    </Card>
  );
}

function MyRequests() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data } = useMyAvailabilityRequests(user?.uid);
  return (
    <Card title={t("myRequests")}>
      {data.length === 0 && <Empty />}
      {data.map((r) => (
        <div key={r.id} className="list-item">
          <div className="spacer">
            <strong>{r.kind === "unavailable" ? t("notAvailable") : t("availableExtra")}</strong>
            <div className="small muted" dir="ltr" style={{ textAlign: "start" }}>
              {r.from} → {r.to}
              {r.hours ? ` · ${r.hours.start}–${r.hours.end}` : ""}
            </div>
          </div>
          <StatusBadge status={r.status} />
          {r.status === "pending" && (
            <button className="btn ghost small" onClick={() => deleteDoc(doc(db, "availabilityRequests", r.id))}>
              {t("withdraw")}
            </button>
          )}
        </div>
      ))}
    </Card>
  );
}

function ReviewQueue() {
  const { t } = useI18n();
  const { data } = usePendingAvailabilityRequests(true);
  const [warning, setWarning] = useState<string | null>(null);

  async function review(requestId: string, approve: boolean) {
    const { data: res } = await api.reviewAvailabilityRequest({ requestId, approve });
    setWarning(res.affectedAppointments > 0 ? `${res.affectedAppointments} ${t("affectedSessions")}` : null);
  }

  return (
    <Card title={t("requestsToReview")}>
      {warning && <div className="alert small" style={{ marginBottom: 12 }}>{warning}</div>}
      {data.length === 0 && <Empty />}
      {data.map((r) => (
        <div key={r.id} className="list-item">
          <div className="spacer">
            <strong>{r.practitionerName}</strong> · {r.kind === "unavailable" ? t("notAvailable") : t("availableExtra")}
            <div className="small muted" dir="ltr" style={{ textAlign: "start" }}>
              {r.from} → {r.to}
              {r.hours ? ` · ${r.hours.start}–${r.hours.end}` : ""}
            </div>
            {r.note && <div className="small">{r.note}</div>}
          </div>
          <button className="btn small" onClick={() => review(r.id, true)}>
            {t("approve")}
          </button>
          <button className="btn secondary small" onClick={() => review(r.id, false)}>
            {t("reject")}
          </button>
        </div>
      ))}
    </Card>
  );
}

function WeeklyHoursEditor() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [hours, setHours] = useState<WeeklyHours>({});
  const [sessionMinutes, setSessionMinutes] = useState(50);
  const [timeZone, setTimeZone] = useState("Asia/Riyadh");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setHours(profile.weeklyHours ?? {});
    setSessionMinutes(profile.sessionMinutes ?? 50);
    setTimeZone(profile.timeZone ?? "Asia/Riyadh");
  }, [profile]);

  if (!profile || !user) return null;

  const setDay = (day: number, value: { start: string; end: string } | null) =>
    setHours((h) => ({ ...h, [day]: value ? [value] : [] }));

  async function save() {
    if (!user) return;
    const update: Partial<Practitioner> = { weeklyHours: hours, sessionMinutes, timeZone };
    await updateDoc(doc(db, "practitioners", user.uid), update);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card title={t("weeklyHours")}>
      <div className="stack">
        <p className="small muted">{t("weeklyHoursHelp")}</p>
        {DAY_KEYS.map((key, day) => {
          const window = hours[day as keyof WeeklyHours]?.[0];
          return (
            <div key={key} className="row">
              <label className="checkbox" style={{ width: 120 }}>
                <input
                  type="checkbox"
                  checked={!!window}
                  onChange={(e) => setDay(day, e.target.checked ? { start: "09:00", end: "17:00" } : null)}
                />
                {t(key)}
              </label>
              {window && (
                <>
                  <input className="input" type="time" style={{ width: 150 }} value={window.start} onChange={(e) => setDay(day, { ...window, start: e.target.value })} />
                  <span className="muted">–</span>
                  <input className="input" type="time" style={{ width: 150 }} value={window.end} onChange={(e) => setDay(day, { ...window, end: e.target.value })} />
                </>
              )}
            </div>
          );
        })}
        <div className="grid grid-2">
          <label className="label">
            {t("sessionLength")}
            <input className="input" type="number" min={15} max={180} step={5} value={sessionMinutes} onChange={(e) => setSessionMinutes(Number(e.target.value))} />
          </label>
          <label className="label">
            {t("timeZone")}
            <input className="input" dir="ltr" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
          </label>
        </div>
        <div>
          <button className="btn" onClick={save}>
            {saved ? `✓ ${t("saved")}` : t("save")}
          </button>
        </div>
      </div>
    </Card>
  );
}
