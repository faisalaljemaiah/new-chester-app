"use client";

import type { Locale, MessageTemplate, TemplateKind } from "@chester/shared";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";

import { Card, Empty, Modal } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import type { WithId } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { useForms, useTemplates } from "@/lib/queries";

export default function TemplatesPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const { data: templates } = useTemplates(user?.uid);
  const [editing, setEditing] = useState<WithId<MessageTemplate> | "new" | null>(null);

  return (
    <>
      <div className="page-header">
        <h1>{t("navTemplates")}</h1>
        <button className="btn" onClick={() => setEditing("new")}>
          + {t("newTemplate")}
        </button>
      </div>
      <div className="grid grid-2">
        {templates.length === 0 && <Empty />}
        {templates.map((tpl) => {
          const canEdit = isAdmin || tpl.ownerId === user?.uid;
          return (
            <Card
              key={tpl.id}
              title={
                <div className="row">
                  <span>{tpl.kind === "assessment" ? "📋" : "✉"}</span>
                  <h3>{tpl.title}</h3>
                </div>
              }
              action={
                <div className="row">
                  <span className="badge neutral">{tpl.shared ? t("sharedTemplate") : t("myTemplate")}</span>
                  <span className="badge neutral">{tpl.locale === "ar" ? t("arabic") : t("english")}</span>
                </div>
              }>
              <p className="muted small" style={{ whiteSpace: "pre-wrap" }} dir={tpl.locale === "ar" ? "rtl" : "ltr"}>
                {tpl.body}
              </p>
              {canEdit && (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn secondary small" onClick={() => setEditing(tpl)}>
                    {t("edit")}
                  </button>
                  <button className="btn ghost small" onClick={() => deleteDoc(doc(db, "templates", tpl.id))}>
                    {t("delete")}
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {editing && <TemplateEditor template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateEditor({ template, onClose }: { template: WithId<MessageTemplate> | null; onClose: () => void }) {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const { data: forms } = useForms();
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? "message");
  const [formId, setFormId] = useState(template?.formId ?? "");
  const [locale, setLocale] = useState<Locale>(template?.locale ?? "en");
  const [shared, setShared] = useState(template?.shared ?? false);

  async function save() {
    if (!user) return;
    const data = {
      title: title.trim(),
      body: body.trim(),
      kind,
      locale,
      shared: isAdmin && shared,
      ...(kind === "assessment" ? { formId } : {}),
    };
    if (template) await updateDoc(doc(db, "templates", template.id), data);
    else await addDoc(collection(db, "templates"), { ...data, ownerId: user.uid, createdAt: serverTimestamp() });
    onClose();
  }

  return (
    <Modal title={template ? t("edit") : t("newTemplate")} onClose={onClose}>
      <div className="stack">
        <label className="label">
          {t("kind")}
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)}>
            <option value="message">{t("messageTemplate")}</option>
            <option value="assessment">{t("assessmentTemplate")}</option>
          </select>
        </label>
        {kind === "assessment" && (
          <label className="label">
            {t("form")}
            <select className="select" value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">—</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="label">
          {t("title")}
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="label">
          {t("templateLanguage")}
          <select className="select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="en">{t("english")}</option>
            <option value="ar">{t("arabic")}</option>
          </select>
        </label>
        <label className="label">
          {t("body")}
          <textarea className="textarea" dir={locale === "ar" ? "rtl" : "ltr"} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {isAdmin && (
          <label className="checkbox">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            {t("sharedTemplate")}
          </label>
        )}
        <button className="btn" onClick={save} disabled={!title.trim() || !body.trim() || (kind === "assessment" && !formId)}>
          {t("save")}
        </button>
      </div>
    </Modal>
  );
}
