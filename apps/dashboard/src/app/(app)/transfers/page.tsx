"use client";

import { doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { useState } from "react";

import { Avatar, Card, Empty, StatusBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api, db } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";
import { useTransfers } from "@/lib/queries";

export default function TransfersPage() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const { data: incoming } = useTransfers(user?.uid, "toPractitionerId");
  const { data: outgoing } = useTransfers(user?.uid, "fromPractitionerId");
  const [busy, setBusy] = useState<string | null>(null);
  const rows = tab === "incoming" ? incoming : outgoing;

  async function respond(transferId: string, accept: boolean) {
    setBusy(transferId);
    try {
      await api.respondToTransfer({ transferId, accept });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>{t("navTransfers")}</h1>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "incoming", label: `${t("incoming")} (${incoming.filter((x) => x.status === "pending").length})` },
            { value: "outgoing", label: t("outgoing") },
          ]}
        />
      </div>
      <Card>
        {rows.length === 0 && <Empty />}
        {rows.map((x) => (
          <div key={x.id} className="list-item" style={{ alignItems: "flex-start" }}>
            <Avatar name={x.patientName} />
            <div className="spacer stack" style={{ gap: 4 }}>
              <div className="row">
                <strong>{x.patientName}</strong>
                <StatusBadge status={x.status} />
              </div>
              <div className="small muted">
                {tab === "incoming" ? `${t("from")} ${x.fromPractitionerName}` : `${t("to")} ${x.toPractitionerName}`}
                {x.createdAt ? ` · ${formatDate(x.createdAt.toDate())}` : ""}
              </div>
              <p className="small">
                <span className="muted">{t("reason")}: </span>
                {x.reason}
              </p>
            </div>
            <div className="row">
              {tab === "incoming" && x.status === "pending" && (
                <>
                  <button className="btn small" disabled={busy === x.id} onClick={() => respond(x.id, true)}>
                    {t("accept")}
                  </button>
                  <button className="btn secondary small" disabled={busy === x.id} onClick={() => respond(x.id, false)}>
                    {t("decline")}
                  </button>
                </>
              )}
              {tab === "incoming" && x.status === "accepted" && (
                <Link className="btn secondary small" href={`/patients/file?id=${x.patientId}`}>
                  {t("openFile")}
                </Link>
              )}
              {tab === "outgoing" && x.status === "pending" && (
                <button className="btn ghost small" onClick={() => updateDoc(doc(db, "transfers", x.id), { status: "cancelled" })}>
                  {t("withdraw")}
                </button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
