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
  const { data: appointments } = useMyAppointments(user?.uid);
  const { data: transfers } = useTransfers(user?.uid, "toPractitionerId");
  const { data: results } = useMyResults(user?.uid);
  const { data: patients } = useMyPatients(user?.uid);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 86_400_000;
  const scheduled = appointments.filter((a) => a.status === "scheduled");
  const today = scheduled.filter((a) => a.start.toMillis() >= startOfDay && a.start.toMillis() < endOfDay);
  const upcoming = scheduled.filter((a) => a.start.toMillis() >= endOfDay).slice(0, 5);
  const pendingTransfers = transfers.filter((x) => x.status === "pending");
  const unreviewed = results.filter((r) => !r.reviewed);
  const flagged = unreviewed.filter((r) => r.safetyFlag);
  const patientName = (id: string) => patients.find((p) => p.id === id)?.displayName ?? "—";

  const hour = now.getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodAfternoon") : t("goodEvening");
  const name = (locale === "ar" && profile?.displayNameAr) || profile?.displayName || "";

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
              <Link key={r.id} className="btn danger small" href={`/patients/file?id=${r.patientId}&tab=assessments`}>
                {patientName(r.patientId)} · {r.formCode}
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
            <div key={a.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/patients/file?id=${a.patientId}`)}>
              <Avatar name={a.patientName} />
              <div className="spacer">
                <strong>{a.patientName}</strong>
                <div className="small muted">
                  {formatTime(a.start.toDate())} · {t(a.mode)}
                </div>
              </div>
              {a.meetingUrl ? (
                <a className="btn small" href={a.meetingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
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
              <Avatar name={a.patientName} />
              <div className="spacer">
                <strong>{a.patientName}</strong>
                <div className="small muted">
                  {formatDate(a.start.toDate())} · {formatTime(a.start.toDate())}
                </div>
              </div>
            </div>
          ))}
        </Card>

        <Card title={t("newResults")} action={<Link className="small muted" href="/assessments">{t("all")}</Link>}>
          {unreviewed.length === 0 && <Empty />}
          {unreviewed.slice(0, 5).map((r) => (
            <div key={r.id} className="list-item" style={{ cursor: "pointer" }} onClick={() => router.push(`/patients/file?id=${r.patientId}&tab=assessments`)}>
              <Avatar name={patientName(r.patientId)} />
              <div className="spacer">
                <strong>{patientName(r.patientId)}</strong>
                <div className="small muted">
                  {r.formCode} · {t("score")} {r.score}/{r.maxScore}
                </div>
              </div>
              <SeverityBadge level={r.severityLevel} label={r.severity} />
            </div>
          ))}
        </Card>

        <Card title={t("pendingTransfers")} action={<Link className="small muted" href="/transfers">{t("all")}</Link>}>
          {pendingTransfers.length === 0 && <Empty />}
          {pendingTransfers.map((x) => (
            <div key={x.id} className="list-item">
              <Avatar name={x.patientName} />
              <div className="spacer">
                <strong>{x.patientName}</strong>
                <div className="small muted">
                  {t("from")} {x.fromPractitionerName}
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
