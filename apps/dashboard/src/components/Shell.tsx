"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useMyResults, usePendingAvailabilityRequests, useTransfers } from "@/lib/queries";
import { resetLink } from "@/lib/supabase";

import { Avatar } from "./ui";

const links: { href: string; key: MessageKey; icon: string; adminOnly?: boolean }[] = [
  { href: "/", key: "navOverview", icon: "◎" },
  { href: "/appointments", key: "navAppointments", icon: "▦" },
  { href: "/patients", key: "navPatients", icon: "◉" },
  { href: "/transfers", key: "navTransfers", icon: "⇄" },
  { href: "/availability", key: "navAvailability", icon: "◷" },
  { href: "/templates", key: "navTemplates", icon: "✉" },
  { href: "/assessments", key: "navAssessments", icon: "☰" },
  { href: "/team", key: "navTeam", icon: "✚", adminOnly: true },
];

/** Signed-in frame: sidebar navigation, language switch and sign-out. Redirects to /login otherwise. */
export function Shell({ children }: { children: ReactNode }) {
  const { user, role, isAdmin, profile, loading, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const isStaff = role === "practitioner" || role === "admin";

  useEffect(() => {
    // A password-reset link may land here; the new-password form is on the login page.
    if (resetLink.pending || (!loading && (!user || !isStaff))) router.replace("/login");
  }, [loading, user, isStaff, router]);

  const { data: incoming } = useTransfers(isStaff ? user?.id : undefined, "to_practitioner_id");
  const { data: results } = useMyResults(isStaff ? user?.id : undefined);
  const { data: pendingRequests } = usePendingAvailabilityRequests(isAdmin);

  const badges = useMemo<Partial<Record<MessageKey, number>>>(
    () => ({
      navTransfers: incoming.filter((x) => x.status === "pending").length,
      navAssessments: results.filter((r) => !r.reviewed).length,
      navAvailability: pendingRequests.length,
    }),
    [incoming, results, pendingRequests],
  );

  if (loading || !user || !isStaff) return <div className="login muted">{t("loading")}</div>;

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">NC</span>
          <div>
            <strong>{t("appName")}</strong>
            <div className="small muted">{t("practitionerPortal")}</div>
          </div>
        </div>
        {links
          .filter((l) => !l.adminOnly || isAdmin)
          .map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const count = badges[l.key] ?? 0;
            return (
              <Link key={l.href} href={l.href} className={`nav-link ${active ? "active" : ""}`}>
                <span aria-hidden>{l.icon}</span>
                {t(l.key)}
                {count > 0 && <span className="nav-badge">{count}</span>}
              </Link>
            );
          })}
        <div className="sidebar-footer">
          <div className="row" style={{ padding: "8px" }}>
            <Avatar name={profile?.display_name ?? user.email ?? ""} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {(locale === "ar" && profile?.display_name_ar) || profile?.display_name}
              </div>
              <div className="small muted">{isAdmin ? "Admin" : profile?.title}</div>
            </div>
          </div>
          <button className="btn secondary" onClick={() => setLocale(locale === "en" ? "ar" : "en")}>
            {t("language")}
          </button>
          <button className="btn ghost" onClick={() => signOut().then(() => router.replace("/login"))}>
            {t("signOut")}
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
