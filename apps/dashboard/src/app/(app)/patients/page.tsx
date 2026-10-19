"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, Card, Empty, StatusBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useMyPatients, usePractitioners } from "@/lib/queries";

export default function PatientsPage() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const { data: patients, loading } = useMyPatients(user?.uid);
  const { data: practitioners } = usePractitioners();
  const [search, setSearch] = useState("");

  const shown = patients
    .filter((p) => `${p.displayName} ${p.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const practitionerName = (id: string | null) => practitioners.find((p) => p.id === id)?.displayName ?? "—";

  return (
    <>
      <div className="page-header">
        <h1>{t("navPatients")}</h1>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder={t("searchPatients")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Card>
        {!loading && shown.length === 0 ? (
          <Empty />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("patient")}</th>
                <th>{t("status")}</th>
                <th>{t("sessionsDone")}</th>
                <th>{t("lastSession")}</th>
                <th>{t("primaryPractitioner")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => router.push(`/patients/file?id=${p.id}`)}>
                  <td>
                    <div className="row">
                      <Avatar name={p.displayName} />
                      <div>
                        <strong>{p.displayName}</strong>
                        <div className="small muted" dir="ltr">
                          {p.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>{p.completedSessions ?? 0}</td>
                  <td>{p.lastSessionAt ? formatDate(p.lastSessionAt.toDate()) : "—"}</td>
                  <td>{practitionerName(p.primaryPractitionerId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
