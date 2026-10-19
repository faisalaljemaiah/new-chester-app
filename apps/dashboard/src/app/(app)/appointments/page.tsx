"use client";

import type { Appointment, AppointmentStatus } from "@chester/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Empty, Modal, StatusBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useMyAppointments } from "@/lib/queries";
import { must, rpc, supabase } from "@/lib/supabase";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const router = useRouter();
  const { data, loading } = useMyAppointments(user?.id);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [linkFor, setLinkFor] = useState<Appointment | null>(null);

  const now = Date.now();
  const upcoming = data.filter((a) => a.status === "scheduled" && Date.parse(a.end_at) > now);
  const past = data.filter((a) => !upcoming.includes(a)).reverse();
  const rows = tab === "upcoming" ? upcoming : past;

  const setStatus = (id: string, status: AppointmentStatus) =>
    must(supabase.from("appointments").update({ status }).eq("id", id)).catch(console.error);

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
                const started = Date.parse(a.start_at) <= now;
                return (
                  <tr key={a.id}>
                    <td>{formatDate(a.start_at)}</td>
                    <td>{formatTime(a.start_at)}</td>
                    <td>
                      <button className="btn ghost small" onClick={() => router.push(`/patients/file?id=${a.patient_id}`)}>
                        {a.patient_name}
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
                                onClick={() => rpc("cancel_appointment", { p_appointment: a.id, p_reason: null }).catch(console.error)}>
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

function MeetingLinkModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(appointment.meeting_url ?? "");
  const valid = /^https:\/\/\S+$/.test(url.trim());
  return (
    <Modal title={t("meetingLink")} onClose={onClose}>
      <div className="stack">
        <p className="muted small">{t("meetingLinkHelp")}</p>
        <input className="input" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        <button
          className="btn"
          disabled={!valid}
          onClick={() =>
            must(supabase.from("appointments").update({ meeting_url: url.trim() }).eq("id", appointment.id))
              .then(onClose)
              .catch(console.error)
          }>
          {t("save")}
        </button>
      </div>
    </Modal>
  );
}
