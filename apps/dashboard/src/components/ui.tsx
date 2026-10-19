"use client";

import type { ReactNode } from "react";

import { useI18n, type MessageKey } from "@/lib/i18n";

export function Card({
  title,
  action,
  children,
  onClick,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <section className={`card ${onClick ? "clickable" : ""} ${className}`} onClick={onClick}>
      {title || action ? (
        <div className="card-title">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return <span className={`avatar ${large ? "lg" : ""}`}>{initials || "?"}</span>;
}

const statusTone: Record<string, string> = {
  scheduled: "",
  completed: "success",
  cancelled: "neutral",
  no_show: "warning",
  pending: "warning",
  accepted: "success",
  approved: "success",
  declined: "neutral",
  rejected: "neutral",
  active: "success",
  on_hold: "warning",
  discharged: "neutral",
  sent: "warning",
};

/** Status pill whose label comes from the dictionary (the status value is also a message key). */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <span className={`badge ${statusTone[status] ?? ""}`}>{t(status as MessageKey) ?? status}</span>;
}

/** Severity 0–4 colored like the patient app. */
export function SeverityBadge({ level, label }: { level: number; label: string }) {
  const { severityLabel } = useI18n();
  const tone = level >= 3 ? "danger" : level === 2 ? "warning" : level === 1 ? "" : "success";
  return <span className={`badge ${tone}`}>{severityLabel(level, label)}</span>;
}

export function Empty({ text }: { text?: string }) {
  const { t } = useI18n();
  return <p className="empty">{text ?? t("none")}</p>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="card-title">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`tab ${o.value === value ? "active" : ""}`}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
