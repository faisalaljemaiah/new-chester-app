"use client";

import type { Appointment, AppointmentStatus } from "@chester/shared";
import { doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Empty, Modal, StatusBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, db } from "@/lib/firebase";
import type { WithId } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { useMyAppointments } from "@/lib/queries";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const router = useRouter();
  const { data, loading } = useMyAppointments(user?.uid);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [linkFor, setLinkFor] = useState<WithId<Appointment> | null>(null);

  const now = Date.now();
  const upcoming = data.filter((a) => a.status === "scheduled" && a.end.toMillis() > now);
  const past = data.filter((a) => !upcoming.includes(a)).reverse();
  const rows = tab === "upcoming" ? upcoming : past;

  const setStatus = (id: string, status: AppointmentStatus) => updateDoc(doc(db, "appointments", id), { status });

  return (
    <>
      <div className="page-header">
        <h1>{t("navAppointments")}</h1>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: `${t("upcoming")} (${upcoming.length})` },
            { value: "past", label: t("past") },
          ]}
        />
      </div>

      <Card>
        {!loading && rows.length === 0 ? (
          <Empty />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("time")}</th>
                <th>{t("patient")}</th>
                <th>{t("mode")}</th>
                <th>{t("status")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const started = a.start.toMillis() <= now;
                return (
                  <tr key={a.id}>
                    <td>{formatDate(a.start.toDate())}</td>
                    <td>{formatTime(a.start.toDate())}</td>
                    <td>
                      <button className="btn ghost small" onClick={() => router.push(`/patients/file?id=${a.patientId}`)}>
                        {a.patientName}
                      </button>
                    </td>
                    <td>{t(a.mode)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                        {a.status === "scheduled" && (
                          <>
                            <button className="btn secondary small" onClick={() => setLinkFor(a)}>
                              {t("meetingLink")}
                            </button>
                            {started && (
                              <>
                                <button className="btn small" onClick={() => setStatus(a.id, "completed")}>
                                  {t("markCompleted")}
                                </button>
                                <button className="btn secondary small" onClick={() => setStatus(a.id, "no_show")}>
                                  {t("markNoShow")}
                                </button>
                              </>
                            )}
                            {!started && (
                              <button
                                className="btn danger small"
                                onClick={() => api.cancelAppointment({ appointmentId: a.id })}>
                                {t("cancelSession")}
                              </button>
                            )}
                          </>
                        )}
                        {/* Let a mistaken outcome be corrected. */}
                        {(a.status === "completed" || a.status === "no_show") && (
                          <select
                            className="select"
                            style={{ width: "auto" }}
                            value={a.status}
                            onChange={(e) => setStatus(a.id, e.target.value as AppointmentStatus)}>
                            <option value="completed">{t("completed")}</option>
                            <option value="no_show">{t("no_show")}</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {linkFor && <MeetingLinkModal appointment={linkFor} onClose={() => setLinkFor(null)} />}
    </>
  );
}

function MeetingLinkModal({ appointment, onClose }: { appointment: WithId<Appointment>; onClose: () => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(appointment.meetingUrl ?? "");
  const valid = /^https:\/\/\S+$/.test(url.trim());
  return (
    <Modal title={t("meetingLink")} onClose={onClose}>
      <div className="stack">
        <p className="muted small">{t("meetingLinkHelp")}</p>
        <input className="input" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        <button
          className="btn"
          disabled={!valid}
          onClick={() => updateDoc(doc(db, "appointments", appointment.id), { meetingUrl: url.trim() }).then(onClose)}>
          {t("save")}
        </button>
      </div>
    </Modal>
  );
}
