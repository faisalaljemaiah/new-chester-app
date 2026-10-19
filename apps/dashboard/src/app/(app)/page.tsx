"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, Card, Empty, SeverityBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useMyAppointments, useMyPatients, useMyResults, useTransfers } from "@/lib/queries";

export default function Overview() {
  const { user, profile } = useAuth();
  const { t, locale, formatTime, formatDate } = useI18n();
  const router = useRouter();
  const { data: appointments } = useMyAppointments(user?.id);
  const { data: transfers } = useTransfers(user?.id, "to_practitioner_id");
  const { data: results } = useMyResults(user?.id);
  const { data: patients } = useMyPatients(user?.id);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 86_400_000;
  const scheduled = appointments.filter((a) => a.status === "scheduled");
  const today = scheduled.filter((a) => Date.parse(a.start_at) >= startOfDay && Date.parse(a.start_at) < endOfDay);
  const upcoming = scheduled.filter((a) => Date.parse(a.start_at) >= endOfDay).slice(0, 5);
  const pendingTransfers = transfers.filter((x) => x.status === "pending");
  const unreviewed = results.filter((r) => !r.reviewed);
  const flagged = unreviewed.filter((r) => r.safety_flag);
  const patientName = (id: string) => patients.find((p) => p.id === id)?.display_name ?? "—";

  const hour = now.getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodAfternoon") : t("goodEvening");
  const name = (locale === "ar" && profile?.display_name_ar) || profile?.display_name || "";

  return (
    <>
      <div className="page-header">
        <div>
          <p className="muted">{formatDate(now)}</p>
          <h1>
            {greeting}, {name}
          </h1>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="alert stack">
          <strong>
            {t("safetyAlerts")} ({flagged.length})
          </strong>
          <span>{t("safetyAlertHelp")}</span>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {flagged.map((r) => (
              <Link key={r.assignment_id} className="btn danger small" href={`/patients/file?id=${r.patient_id}&tab=assessments`}>
                {patientName(r.patient_id)} · {r.form_code}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-4">
        <Stat label={t("todaySessions")} value={today.length} />
        <Stat label={t("pendingTransfers")} value={pendingTransfers.length} href="/transfers" />
        <Stat label={t("newResults")} value={unreviewed.length} href="/assessments" />
        <Stat label={t("navPatients")} value={patients.length} href="/patients" />
      </div>

      <div className="grid grid-2">
        <Card title={t("todaySessions")}>
          {today.length === 0 && <Empty text={t("noSessionsToday")} />}
          {today.map((a) => (
            <div key={a.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/patients/file?id=${a.patient_id}`)}>
              <Avatar name={a.patient_name} />
              <div className="spacer">
                <strong>{a.patient_name}</strong>
                <div className="small muted">
                  {formatTime(a.start_at)} · {t(a.mode)}
                </div>
              </div>
              {a.meeting_url ? (
                <a className="btn small" href={a.meeting_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  {t("video")}
                </a>
              ) : null}
            </div>
          ))}
        </Card>

        <Card title={t("upcomingSessions")} action={<Link className="small muted" href="/appointments">{t("all")}</Link>}>
          {upcoming.length === 0 && <Empty />}
          {upcoming.map((a) => (
            <div key={a.id} className="list-item">
              <Avatar name={a.patient_name} />
              <div className="spacer">
                <strong>{a.patient_name}</strong>
                <div className="small muted">
                  {formatDate(a.start_at)} · {formatTime(a.start_at)}
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card title={t("newResults")} action={<Link className="small muted" href="/assessments">{t("all")}</Link>}>
          {unreviewed.length === 0 && <Empty />}
          {unreviewed.slice(0, 5).map((r) => (
            <div key={r.assignment_id} className="list-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/patients/file?id=${r.patient_id}&tab=assessments`)}>
              <Avatar name={patientName(r.patient_id)} />
              <div className="spacer">
                <strong>{patientName(r.patient_id)}</strong>
                <div className="small muted">
                  {r.form_code} · {t("score")} {r.score}/{r.max_score}
                </div>
              </div>
              <SeverityBadge level={r.severity_level} label={r.severity} />
            </div>
          ))}
        </Card>

        <Card title={t("pendingTransfers")} action={<Link className="small muted" href="/transfers">{t("all")}</Link>}>
          {pendingTransfers.length === 0 && <Empty />}
          {pendingTransfers.map((x) => (
            <div key={x.id} className="list-item">
              <Avatar name={x.patient_name} />
              <div className="spacer">
                <strong>{x.patient_name}</strong>
                <div className="small muted">
                  {t("from")} {x.from_practitioner_name}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <section className={`card ${href ? "clickable" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="muted small">{label}</div>
    </section>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
