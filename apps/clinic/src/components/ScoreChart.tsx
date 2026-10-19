import { colors, spacing, type AssessmentResult, type SeverityBand } from '@chester/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

const H = 180;
// The score labels sit on the side the axis starts from: left in English, right in Arabic.
const PAD = { top: 12, bottom: 24, axis: 32, end: 16 };

/**
 * One questionnaire's scores over time. Each form gets its own small chart (PHQ-9 runs
 * 0–27, GAD-7 0–21) rather than sharing an axis. Gridlines sit at the severity cut-offs.
 * Tap a point to see its date and score.
 */
export function ScoreChart({
  title,
  results,
  maxScore,
  bands,
}: {
  title: string;
  results: AssessmentResult[];
  maxScore: number;
  bands: SeverityBand[];
}) {
  const { formatDate, formatShortDate, dir, severityLabel } = useI18n();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const points = [...results].sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at));
  if (points.length === 0) return null;

  const rtl = dir === 'rtl';
  const padLeft = rtl ? PAD.end : PAD.axis;
  const padRight = rtl ? PAD.axis : PAD.end;
  const innerW = Math.max(0, width - padLeft - padRight);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => {
    const pos = points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW;
    // Time runs right-to-left in Arabic.
    return padLeft + (rtl ? innerW - pos : pos);
  };
  const y = (v: number) => PAD.top + innerH - (v / maxScore) * innerH;
  const line = points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ');
  const last = points[points.length - 1];
  const active = selected !== null ? points[selected] : null;
  // SVG anchors are physical here (the wrapper forces ltr), so pick the inward side by hand.
  const inward = (first: boolean) => ((first ? !rtl : rtl) ? 'start' : 'end');

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.caption}>
        <Text variant="heading">{title}</Text>
        <Text variant="small" style={{ flexShrink: 1 }}>
          {active
            ? `${formatDate(active.completed_at)} · ${active.score}/${maxScore} · ${severityLabel(active.severity_level, active.severity)}`
            : `${last.score}/${maxScore} · ${severityLabel(last.severity_level, last.severity)}`}
        </Text>
      </View>
      <View style={styles.plot} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={title}>
        {width > 0 ? (
          <Svg width={width} height={H}>
            {[0, ...bands.slice(1).map((b) => b.min), maxScore].map((v) => (
              <Line
                key={`grid-${v}`}
                x1={padLeft}
                x2={width - padRight}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {[0, ...bands.slice(1).map((b) => b.min), maxScore].map((v) => (
              <SvgText
                key={`label-${v}`}
                x={rtl ? width - padRight + 6 : padLeft - 6}
                y={y(v) + 4}
                fontSize={10}
                fill={colors.textFaint}
                textAnchor={rtl ? 'start' : 'end'}>
                {String(v)}
              </SvgText>
            ))}
            {points.length > 1 ? (
              <Polyline
                points={line}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {selected !== null ? (
              <Line
                x1={x(selected)}
                x2={x(selected)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke={colors.textMuted}
                strokeWidth={1}
              />
            ) : null}
            {points.map((p, i) => (
              <Circle
                key={`dot-${p.assignment_id}`}
                cx={x(i)}
                cy={y(p.score)}
                r={selected === i ? 6 : 4}
                fill={p.safety_flag ? colors.danger : colors.primary}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ))}
            {/* Larger invisible tap targets than the visible dots, drawn on top. */}
            {points.map((p, i) => (
              <Circle
                key={`hit-${p.assignment_id}`}
                cx={x(i)}
                cy={y(p.score)}
                r={16}
                fill="transparent"
                onPress={() => setSelected(selected === i ? null : i)}
              />
            ))}
            {/* First and last dates, anchored inward so they never clip at the edges. */}
            <SvgText
              x={x(0)}
              y={H - 6}
              fontSize={10}
              fill={colors.textFaint}
              textAnchor={points.length > 1 ? inward(true) : 'middle'}>
              {formatShortDate(points[0].completed_at)}
            </SvgText>
            {points.length > 1 ? (
              <SvgText x={x(points.length - 1)} y={H - 6} fontSize={10} fill={colors.textFaint} textAnchor={inward(false)}>
                {formatShortDate(last.completed_at)}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  // Coordinates are mirrored by hand above, so keep the drawing itself left-to-right.
  plot: { height: H, direction: 'ltr' },
});
