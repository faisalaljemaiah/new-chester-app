"use client";

import type { Discipline } from "@chester/shared";
import { useState } from "react";

import { Avatar, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";
import { usePractitioners } from "@/lib/queries";

export default function TeamPage() {
  const { isAdmin } = useAuth();
  const { t, locale } = useI18n();
  const { data: practitioners } = usePractitioners();
  const [form, setForm] = useState({ email: "", displayName: "", title: "", discipline: "psychiatry" as Discipline, admin: false });
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.createPractitioner(form);
      setLink(data.setPasswordLink);
      setForm({ email: "", displayName: "", title: "", discipline: "psychiatry", admin: false });
    } catch (e) {
      setError((e as Error).message || t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>{t("navTeam")}</h1>
      </div>
      <div className="grid grid-2">
        <Card title={t("addPractitioner")}>
          <div className="stack">
            <label className="label">
              {t("name")}
              <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </label>
            <label className="label">
              {t("email")}
              <input className="input" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="label">
              {t("jobTitle")}
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="label">
              {t("discipline")}
              <select className="select" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value as Discipline })}>
                <option value="psychiatry">{t("psychiatry")}</option>
                <option value="psychology">{t("psychology")}</option>
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} />
              {t("makeAdmin")}
            </label>
            {error && <div className="alert small">{error}</div>}
            <button className="btn" onClick={submit} disabled={busy || !form.email || !form.displayName || !form.title}>
              {t("addPractitioner")}
            </button>
            {link && (
              <div className="notice stack small">
                {t("setPasswordLink")}
                <code dir="ltr" style={{ wordBreak: "break-all" }}>{link}</code>
                <button className="btn secondary small" onClick={() => navigator.clipboard.writeText(link)}>
                  {t("copy")}
                </button>
              </div>
            )}
          </div>
        </Card>
        <Card title={t("navTeam")}>
          {practitioners.map((p) => (
            <div key={p.id} className="list-item">
              <Avatar name={p.displayName} />
              <div className="spacer">
                <strong>{(locale === "ar" && p.displayNameAr) || p.displayName}</strong>
                <div className="small muted">
                  {p.title} · {t(p.discipline)}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
