"use client";

import type { Discipline } from "@chester/shared";
import { useState } from "react";

import { Avatar, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePractitioners } from "@/lib/queries";
import { rpc } from "@/lib/supabase";

export default function TeamPage() {
  const { isAdmin } = useAuth();
  const { t, locale } = useI18n();
  // The directory isn't broadcast by Realtime, so reload it after adding someone.
  const { data: practitioners, refresh } = usePractitioners();
  const [form, setForm] = useState({ email: "", displayName: "", title: "", discipline: "psychiatry" as Discipline, admin: false });
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    setAdded(false);
    try {
      // Turns an existing account into a practitioner; the database explains if there's no account yet.
      await rpc<string>("promote_to_practitioner", {
        p_email: form.email.trim(),
        p_display_name: form.displayName.trim(),
        p_title: form.title.trim(),
        p_discipline: form.discipline,
        p_make_admin: form.admin,
      });
      setAdded(true);
      await refresh();
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
            <p className="small muted">{t("inviteFirst")}</p>
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
            {added && <div className="notice small">{t("practitionerAdded")}</div>}
          </div>
        </Card>
        <Card title={t("navTeam")}>
          {practitioners.map((p) => (
            <div key={p.id} className="list-item">
              <Avatar name={p.display_name} />
              <div className="spacer">
                <strong>{(locale === "ar" && p.display_name_ar) || p.display_name}</strong>
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
