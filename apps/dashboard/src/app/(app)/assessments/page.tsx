"use client";

import { useRouter } from "next/navigation";

import { Card, Empty, SeverityBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useMyPatients, useMyResults } from "@/lib/queries";
import { must, supabase } from "@/lib/supabase";

const markReviewed = (assignmentId: string) =>
  must(supabase.from("assessment_results").update({ reviewed: true }).eq("assignment_id", assignmentId)).catch(console.error);

export default function AssessmentsPage() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const { data: results, loading } = useMyResults(user?.id);
  const { data: patients } = useMyPatients(user?.id);
  const name = (id: string) => patients.find((p) => p.id === id)?.display_name ?? "—";

  // Unreviewed safety flags first, then unreviewed, then newest.
  const rank = (r: (typeof results)[number]) => (r.reviewed ? 2 : r.safety_flag ? 0 : 1);
  const sorted = [...results].sort((a, b) => rank(a) - rank(b) || Date.parse(b.completed_at) - Date.parse(a.completed_at));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t("navAssessments")}</h1>
          <p className="small muted">{t("flaggedFirst")}</p>
        </div>
      </div>
      <Card>
        {!loading && sorted.length === 0 ? (
          <Empty />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("patient")}</th>
                <th>{t("form")}</th>
                <th>{t("date")}</th>
                <th>{t("score")}</th>
                <th>{t("severity")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.assignment_id} className="clickable" onClick={() => router.push(`/patients/file?id=${r.patient_id}&tab=assessments`)}>
                  <td>
                    <strong>{name(r.patient_id)}</strong>
                    {r.safety_flag && <span className="badge danger" style={{ marginInlineStart: 8 }}>⚠</span>}
                  </td>
                  <td>{r.form_code}</td>
                  <td>{formatDate(r.completed_at)}</td>
                  <td>
                    {r.score}/{r.max_score}
                  </td>
                  <td>
                    <SeverityBadge level={r.severity_level} label={r.severity} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {r.reviewed ? (
                      <span className="badge success">{t("reviewed")}</span>
                    ) : (
                      <button className="btn secondary small" onClick={() => markReviewed(r.assignment_id)}>
                        {t("markReviewed")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
