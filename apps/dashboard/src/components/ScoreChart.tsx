"use client";

import type { AssessmentResult, SeverityBand } from "@chester/shared";
import { useState } from "react";

import type { WithId } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

const W = 520;
const H = 180;
const PAD = { top: 12, right: 16, bottom: 24, left: 32 };

/**
 * One questionnaire's scores over time. Each form gets its own small chart (PHQ-9 runs
 * 0–27, GAD-7 0–21) rather than sharing an axis. Gridlines sit at the severity cut-offs.
 */
export function ScoreChart({
  title,
  results,
  maxScore,
  bands,
}: {
  title: string;
  results: WithId<AssessmentResult>[];
  maxScore: number;
  bands: SeverityBand[];
}) {
  const { formatDate, formatShortDate, dir, severityLabel } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const points = [...results].sort((a, b) => a.completedAt.toMillis() - b.completedAt.toMillis());
  if (points.length === 0) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => {
    const pos = points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW;
    // Time runs right-to-left in Arabic.
    return PAD.left + (dir === "rtl" ? innerW - pos : pos);
  };
  const y = (v: number) => PAD.top + innerH - (v / maxScore) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const last = points[points.length - 1];
  const active = hover !== null ? points[hover] : null;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong>{title}</strong>
        <span className="small muted">
          {active
            ? `${formatDate(active.completedAt.toDate())} · ${active.score}/${maxScore} · ${severityLabel(active.severityLevel, active.severity)}`
            : `${last.score}/${maxScore} · ${severityLabel(last.severityLevel, last.severity)}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0, ...bands.slice(1).map((b) => b.min), maxScore].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text
              x={dir === "rtl" ? W - PAD.right + 4 : PAD.left - 6}
              y={y(v) + 4}
              fontSize={10}
              fill="var(--faint)"
              textAnchor={dir === "rtl" ? "start" : "end"}>
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted)" strokeWidth={1} />
        )}
        {points.map((p, i) => (
          <g key={p.id} onMouseEnter={() => setHover(i)}>
            {/* Larger invisible hit target than the visible dot. */}
            <circle cx={x(i)} cy={y(p.score)} r={12} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.score)}
              r={hover === i ? 6 : 4}
              fill={p.safetyFlag ? "var(--danger)" : "var(--primary)"}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        ))}
        {/* First and last dates, anchored inward so they never clip at the edges. */}
        <text x={x(0)} y={H - 6} fontSize={10} fill="var(--faint)" textAnchor={points.length > 1 ? "start" : "middle"}>
          {formatShortDate(points[0].completedAt.toDate())}
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 6} fontSize={10} fill="var(--faint)" textAnchor="end">
            {formatShortDate(last.completedAt.toDate())}
          </text>
        )}
      </svg>
    </figure>
  );
}
