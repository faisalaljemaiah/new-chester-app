"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { Card, Empty, SeverityBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";
import { useMyPatients, useMyResults } from "@/lib/queries";

export default function AssessmentsPage() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const { data: results, loading } = useMyResults(user?.uid);
  const { data: patients } = useMyPatients(user?.uid);
  const name = (id: string) => patients.find((p) => p.id === id)?.displayName ?? "—";

  // Unreviewed safety flags first, then unreviewed, then newest.
  const rank = (r: (typeof results)[number]) => (r.reviewed ? 2 : r.safetyFlag ? 0 : 1);
  const sorted = [...results].sort((a, b) => rank(a) - rank(b) || b.completedAt.toMillis() - a.completedAt.toMillis());

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
                <tr key={r.id} className="clickable" onClick={() => router.push(`/patients/file?id=${r.patientId}&tab=assessments`)}>
                  <td>
                    <strong>{name(r.patientId)}</strong>
                    {r.safetyFlag && <span className="badge danger" style={{ marginInlineStart: 8 }}>⚠</span>}
                  </td>
                  <td>{r.formCode}</td>
                  <td>{formatDate(r.completedAt.toDate())}</td>
                  <td>
                    {r.score}/{r.maxScore}
                  </td>
                  <td>
                    <SeverityBadge level={r.severityLevel} label={r.severity} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {r.reviewed ? (
                      <span className="badge success">{t("reviewed")}</span>
                    ) : (
                      <button className="btn secondary small" onClick={() => updateDoc(doc(db, "assessmentResults", r.id), { reviewed: true })}>
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
