"use client";

import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isStaff = role === "practitioner" || role === "admin";
  useEffect(() => {
    if (!loading && user && isStaff) router.replace("/");
  }, [loading, user, isStaff, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await cred.user.getIdTokenResult(true);
      if (token.claims.role !== "practitioner" && token.claims.role !== "admin") {
        await signOut();
        setMessage(t("notStaff"));
      } else {
        // Reload so the auth context picks up the fresh claims.
        window.location.assign("/");
      }
    } catch {
      setMessage(t("wrongCredentials"));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) return;
    await sendPasswordResetEmail(auth, email.trim()).catch(() => {});
    setMessage(t("resetSent"));
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
