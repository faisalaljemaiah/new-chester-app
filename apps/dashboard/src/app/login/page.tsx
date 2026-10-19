"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { resetLink, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(resetLink.pending);

  const isStaff = role === "practitioner" || role === "admin";
  useEffect(() => {
    if (!recovering && !loading && user && isStaff) router.replace("/");
  }, [recovering, loading, user, isStaff, router]);

  // A patient account that is already signed in (e.g. from the patient app) can't use the portal.
  useEffect(() => {
    if (!recovering && !loading && user && role === "patient") {
      void signOut();
      setMessage(t("notStaff"));
    }
  }, [recovering, loading, user, role, signOut, t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // The role lives in profiles; only staff may use the portal.
      const { data: account } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (account?.role !== "practitioner" && account?.role !== "admin") {
        await signOut();
        setMessage(t("notStaff"));
      } else {
        router.replace("/");
      }
    } catch {
      setMessage(t("wrongCredentials"));
    } finally {
      setBusy(false);
    }
  }

  // Patients' reset links land here too, so this works for every account.
  async function saveNewPassword(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMessage(t("passwordTooShort"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    setPassword("");
    await signOut();
    resetLink.pending = false;
    setRecovering(false);
    setMessage(t("passwordSaved"));
  }

  async function reset() {
    if (!email.trim()) return;
    await supabase.auth
      .resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/login" })
      .catch(() => {});
    setMessage(t("resetSent"));
  }

  if (recovering) {
    return (
      <div className="login">
        <form className="card stack" onSubmit={saveNewPassword}>
          <h2>{t("newPassword")}</h2>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {message && <div className="notice small">{message}</div>}
          <button className="btn" disabled={busy || !user}>
            {t("savePassword")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div className="row">
          <span className="brand-mark">NC</span>
          <div className="spacer">
            <h2>{t("appName")}</h2>
            <div className="small muted">{t("practitionerPortal")}</div>
          </div>
          <button type="button" className="btn ghost small" onClick={() => setLocale(locale === "en" ? "ar" : "en")}>
            {t("language")}
          </button>
        </div>
        <label className="label">
          {t("email")}
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="label">
          {t("password")}
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {message && <div className="notice small">{message}</div>}
        <button className="btn" disabled={busy}>
          {t("signIn")}
        </button>
        <button type="button" className="btn ghost small" onClick={reset}>
          {t("forgotPassword")}
        </button>
      </form>
    </div>
  );
}
