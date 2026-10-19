"use client";

import Link from "next/link";
import { useState } from "react";

import { Avatar, Card, Empty, StatusBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTransfers } from "@/lib/queries";
import { must, rpc, supabase } from "@/lib/supabase";

export default function TransfersPage() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const { data: incoming } = useTransfers(user?.id, "to_practitioner_id");
  const { data: outgoing } = useTransfers(user?.id, "from_practitioner_id");
  const [busy, setBusy] = useState<string | null>(null);
  const rows = tab === "incoming" ? incoming : outgoing;

  async function respond(transferId: string, accept: boolean) {
    setBusy(transferId);
    try {
      await rpc("respond_to_transfer", { p_transfer: transferId, p_accept: accept });
    } catch (e) {
      console.error(e);
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
            <Avatar name={x.patient_name} />
            <div className="spacer stack" style={{ gap: 4 }}>
              <div className="row">
                <strong>{x.patient_name}</strong>
                <StatusBadge status={x.status} />
              </div>
              <div className="small muted">
                {tab === "incoming" ? `${t("from")} ${x.from_practitioner_name}` : `${t("to")} ${x.to_practitioner_name}`}
                {` · ${formatDate(x.created_at)}`}
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
                <Link className="btn secondary small" href={`/patients/file?id=${x.patient_id}`}>
                  {t("openFile")}
                </Link>
              )}
              {tab === "outgoing" && x.status === "pending" && (
                <button className="btn ghost small" onClick={() =>
                    must(supabase.from("transfers").update({ status: "cancelled" }).eq("id", x.id)).catch(console.error)
                  }>
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
