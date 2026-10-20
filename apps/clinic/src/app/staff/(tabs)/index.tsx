import { colors, radius, spacing, type Appointment } from '@chester/shared';
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView, PressableScale } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMyAppointments, useMyPatients, useMyResults, useTransfers } from '@/lib/staff-queries';

/** Dark palette of the dashboard, after fai's reference; the accent is the clinic purple. */
export const dark = {
  page: '#151517',
  card: '#242428',
  raised: '#323238',
  text: '#FFFFFF',
  muted: '#9A9AA2',
  onAccent: '#140F26',
  green: '#30D158',
  red: '#FF453A',
};

const DAY = 86_400_000;

const openPatient = (id: string, tab?: string) =>
  router.push({ pathname: '/staff/patient/[id]', params: tab ? { id, tab } : { id } });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Practitioner dashboard: today, patients, attendance, income, a calendar of sessions and their patients. */
export default function Overview() {
  const { user, practitioner } = useAuth();
  const { t, locale, dir, formatTime, formatDate } = useI18n();
  const { data: appointments } = useMyAppointments(user?.id);
  const { data: transfers } = useTransfers(user?.id, 'to_practitioner_id');
  const { data: results } = useMyResults(user?.id);
  const { data: patients } = useMyPatients(user?.id);

  // Light status bar text over the dark page while this tab is showing.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const intl = locale === 'ar' ? 'ar' : 'en-US';
  const money = (n: number) =>
    new Intl.NumberFormat(intl, { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

  const now = new Date();
  const today0 = startOfDay(now).getTime();
  const live = appointments.filter((a) => a.status !== 'cancelled');
  const today = live
    .filter((a) => Date.parse(a.start_at) >= today0 && Date.parse(a.start_at) < today0 + DAY)
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const todayDone = today.filter((a) => a.status === 'completed' || Date.parse(a.end_at) < now.getTime()).length;
  const next = today.find((a) => a.status === 'scheduled' && Date.parse(a.end_at) > now.getTime());

  const activePatients = patients.filter((p) => p.status === 'active').length;
  const since90 = now.getTime() - 90 * DAY;
  const recent = appointments.filter(
    (a) => Date.parse(a.start_at) >= since90 && Date.parse(a.start_at) < now.getTime(),
  );
  const attended = recent.filter((a) => a.status === 'completed').length;
  const missed = recent.filter((a) => a.status === 'no_show').length;
  const attendance = attended + missed ? Math.round((attended / (attended + missed)) * 100) : null;

  // Income: completed sessions this month, plus what's still booked for the rest of it.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const inRange = (a: Appointment, from: number, to: number) => {
    const s = Date.parse(a.start_at);
    return s >= from && s < to;
  };
  const sum = (list: Appointment[]) => list.reduce((n, a) => n + Number(a.fee ?? 0), 0);
  const earned = sum(appointments.filter((a) => a.status === 'completed' && inRange(a, monthStart, nextMonth)));
  const bookedIncome = sum(appointments.filter((a) => a.status === 'scheduled' && inRange(a, monthStart, nextMonth)));
  const lastMonth = sum(appointments.filter((a) => a.status === 'completed' && inRange(a, lastMonthStart, monthStart)));
  const trend = lastMonth ? Math.round(((earned - lastMonth) / lastMonth) * 100) : null;
  const feeMissing = !practitioner?.session_fee && earned === 0 && bookedIncome === 0;

  const pendingTransfers = transfers.filter((x) => x.status === 'pending');
  const unreviewed = results.filter((r) => !r.reviewed);
  const flagged = unreviewed.filter((r) => r.safety_flag);
  const patientName = (id: string) => patients.find((p) => p.id === id)?.display_name ?? '—';

  const name = (locale === 'ar' && practitioner?.display_name_ar) || practitioner?.display_name || '';
  const chevron = dir === 'rtl' ? 'chevron.left' : 'chevron.right';
  const chevronMaterial = dir === 'rtl' ? 'chevron_left' : 'chevron_right';

  return (
    <SafeAreaView edges={['top']} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInView style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.date}>{formatDate(now)}</Text>
            <Text style={styles.name}>{name}</Text>
          </View>
          <PressableScale onPress={() => router.push('/staff/(tabs)/more')} style={styles.photo}>
            {practitioner?.photo_url ? (
              <Image source={{ uri: practitioner.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.photoInitials}>{initials(name)}</Text>
            )}
          </PressableScale>
        </FadeInView>

        {flagged.length > 0 && (
          <FadeInView index={1} style={styles.alert}>
            <View style={styles.row}>
              <Icon ios="exclamationmark.triangle.fill" material="warning" color={dark.red} size={20} />
              <Text style={[styles.cardTitle, { color: dark.red }]}>
                {t('safetyAlerts')} ({flagged.length})
              </Text>
            </View>
            <Text style={styles.muted}>{t('safetyAlertHelp')}</Text>
            <View style={styles.wrap}>
              {flagged.map((r) => (
                <PressableScale
                  key={r.assignment_id}
                  style={styles.alertChip}
                  onPress={() => openPatient(r.patient_id, 'assessments')}>
                  <Text style={styles.alertChipText}>
                    {patientName(r.patient_id)} · {r.form_code}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </FadeInView>
        )}

        {/* Today's schedule */}
        <FadeInView index={1} style={styles.hero}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>{t('todaysSchedule')}</Text>
              <View style={styles.heroCount}>
                <Text style={styles.heroNumber}>{today.length}</Text>
                <Text style={styles.heroWord}>{today.length === 1 ? t('appointmentWord') : t('appointmentsWord')}</Text>
              </View>
            </View>
            {today.length > 0 ? <Meter value={todayDone / today.length} /> : null}
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.row}>
            <Icon ios="calendar.badge.clock" material="event_upcoming" color={dark.onAccent} size={26} />
            <View style={{ flex: 1 }}>
              {next ? (
                <>
                  <Text style={styles.heroSmall}>
                    {t('nextUp')} · {formatTime(next.start_at)}
                  </Text>
                  <Text style={styles.heroNext} numberOfLines={1}>
                    {next.patient_name}
                  </Text>
                </>
              ) : (
                <Text style={styles.heroNext}>{t('nothingElseToday')}</Text>
              )}
            </View>
            <PressableScale
              style={styles.heroButton}
              onPress={() => (next ? openPatient(next.patient_id) : router.push('/staff/(tabs)/appointments'))}>
              <Text style={styles.heroButtonText}>{next ? t('openFile') : t('calendar')}</Text>
            </PressableScale>
          </View>
        </FadeInView>

        {/* Patients and attendance */}
        <FadeInView index={2} style={styles.tiles}>
          <Tile
            title={t('navPatients')}
            subtitle={t('assignedToYou')}
            value={String(patients.length)}
            progress={patients.length ? activePatients / patients.length : 0}
            onPress={() => router.push('/staff/(tabs)/patients')}
          />
          <Tile
            title={t('attendance')}
            subtitle={t('past90Days')}
            value={attendance === null ? '—' : `${attendance}%`}
            progress={(attendance ?? 0) / 100}
          />
        </FadeInView>

        {/* Income */}
        <FadeInView index={3} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('income')}</Text>
              <Text style={styles.muted}>{t('thisMonth')}</Text>
            </View>
            {trend !== null ? (
              <View style={styles.row}>
                <Icon
                  ios={trend >= 0 ? 'arrowtriangle.up.fill' : 'arrowtriangle.down.fill'}
                  material={trend >= 0 ? 'arrow_drop_up' : 'arrow_drop_down'}
                  color={trend >= 0 ? dark.green : dark.red}
                  size={16}
                />
                <Text style={[styles.small, { color: trend >= 0 ? dark.green : dark.red }]}>
                  {Math.abs(trend)}% {t('vsLastMonth')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.bigMoney}>{money(earned)}</Text>
          <SplitBar a={earned} b={bookedIncome} />
          <View style={[styles.row, { gap: spacing.lg }]}>
            <Legend color={colors.primary} label={`${t('earned')} ${money(earned)}`} />
            <Legend color="#5B4A9E" label={`${t('booked')} ${money(bookedIncome)}`} />
          </View>
          {feeMissing ? <Text style={styles.muted}>{t('feeNotSet')}</Text> : null}
        </FadeInView>

        {/* Calendar of sessions */}
        <FadeInView index={4}>
          <SessionCalendar appointments={live} intl={intl} />
        </FadeInView>

        {/* Patients */}
        <FadeInView index={5} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('yourPatients')}</Text>
              <Text style={styles.muted}>{t('patientsPrivate')}</Text>
            </View>
            <PressableScale onPress={() => router.push('/staff/(tabs)/patients')} hitSlop={8}>
              <Text style={styles.link}>{t('all')}</Text>
            </PressableScale>
          </View>
          {patients.length === 0 ? <Text style={styles.muted}>{t('none')}</Text> : null}
          {patients.slice(0, 5).map((p, i) => (
            <PressableScale key={p.id} onPress={() => openPatient(p.id)} scaleTo={0.98}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <View style={[styles.row, { paddingVertical: spacing.sm }]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(p.display_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.display_name}</Text>
                  <Text style={styles.small}>
                    {p.completed_sessions} {t('sessionsWord')}
                    {p.last_session_at ? ` · ${formatDate(p.last_session_at)}` : ''}
                  </Text>
                </View>
                <Icon ios={chevron} material={chevronMaterial} color={dark.muted} size={18} />
              </View>
            </PressableScale>
          ))}
        </FadeInView>

        {/* Needs attention */}
        {unreviewed.length + pendingTransfers.length > 0 && (
          <FadeInView index={6} style={styles.card}>
            <Text style={styles.cardTitle}>{t('needsAttention')}</Text>
            <AttentionRow
              label={t('newResults')}
              count={unreviewed.length}
              href="/staff/(tabs)/assessments"
              chevron={chevron}
              chevronMaterial={chevronMaterial}
            />
            <AttentionRow
              label={t('pendingTransfers')}
              count={pendingTransfers.length}
              href="/staff/transfers"
              chevron={chevron}
              chevronMaterial={chevronMaterial}
            />
          </FadeInView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/** Vertical meter with a percentage tag, like the reference's "78%". */
function Meter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterTag}>
        <Text style={styles.meterTagText}>{pct}%</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { height: `${pct}%` }]} />
      </View>
    </View>
  );
}

function Tile({
  title,
  subtitle,
  value,
  progress,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: string;
  progress: number;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} scaleTo={0.97} style={[styles.card, styles.tile]}>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <View style={{ gap: spacing.md }}>
        <Text style={styles.tileValue}>{value}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }]} />
        </View>
      </View>
    </PressableScale>
  );
}

function SplitBar({ a, b }: { a: number; b: number }) {
  const total = a + b;
  return (
    <View style={[styles.track, { flexDirection: 'row', height: 8 }]}>
      {total > 0 ? (
        <>
          <View style={{ flex: a, backgroundColor: colors.primary }} />
          <View style={{ flex: b, backgroundColor: '#5B4A9E' }} />
        </>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.row, { gap: 6 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function AttentionRow({
  label,
  count,
  href,
  chevron,
  chevronMaterial,
}: {
  label: string;
  count: number;
  href: Href;
  chevron: string;
  chevronMaterial: string;
}) {
  if (!count) return null;
  return (
    <PressableScale onPress={() => router.push(href)} scaleTo={0.98} style={[styles.row, { paddingVertical: 6 }]}>
      <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
      <View style={styles.countPill}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <Icon ios={chevron} material={chevronMaterial} color={dark.muted} size={18} />
    </PressableScale>
  );
}

/** Month calendar with a dot on each day that has sessions; tapping a day lists them. */
function SessionCalendar({ appointments, intl }: { appointments: Appointment[]; intl: string }) {
  const { t, dir, formatTime } = useI18n();
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const k = dayKey(new Date(a.start_at));
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    for (const list of map.values()) list.sort((x, y) => Date.parse(x.start_at) - Date.parse(y.start_at));
    return map;
  }, [appointments]);

  // Six rows of seven days, starting on the Sunday on or before the 1st.
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const cells = Array.from(
    { length: 42 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i),
  );
  const weekdays = cells.slice(0, 7).map((d) => d.toLocaleDateString(intl, { weekday: 'narrow' }));
  const sessions = byDay.get(dayKey(selected)) ?? [];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const back = dir === 'rtl' ? 'chevron.right' : 'chevron.left';
  const forward = dir === 'rtl' ? 'chevron.left' : 'chevron.right';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>
          {month.toLocaleDateString(intl, { month: 'long', year: 'numeric' })}
        </Text>
        <PressableScale onPress={() => shift(-1)} hitSlop={8} style={styles.navButton}>
          <Icon
            ios={back}
            material={dir === 'rtl' ? 'chevron_right' : 'chevron_left'}
            color={colors.primary}
            size={18}
          />
        </PressableScale>
        <PressableScale onPress={() => shift(1)} hitSlop={8} style={styles.navButton}>
          <Icon
            ios={forward}
            material={dir === 'rtl' ? 'chevron_left' : 'chevron_right'}
            color={colors.primary}
            size={18}
          />
        </PressableScale>
      </View>

      <View style={styles.grid}>
        {weekdays.map((w, i) => (
          <Text key={`w${i}`} style={styles.weekday}>
            {w}
          </Text>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isSelected = d.getTime() === selected.getTime();
          const isToday = d.getTime() === today.getTime();
          const has = byDay.has(dayKey(d));
          return (
            <PressableScale key={d.getTime()} onPress={() => setSelected(d)} scaleTo={0.9} style={styles.cell}>
              <View
                style={[styles.dayCircle, isSelected && styles.daySelected, !isSelected && isToday && styles.dayToday]}>
                <Text
                  style={[
                    styles.dayText,
                    !inMonth && { color: '#55555C' },
                    isSelected && { color: dark.onAccent, fontWeight: '700' },
                  ]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={[styles.dot, { opacity: has ? 1 : 0 }]} />
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.separator} />
      {sessions.length === 0 ? <Text style={styles.muted}>{t('noSessionsThisDay')}</Text> : null}
      {sessions.map((a) => (
        <PressableScale key={a.id} onPress={() => openPatient(a.patient_id)} scaleTo={0.98} style={styles.sessionRow}>
          <View style={[styles.sessionBar, a.status === 'completed' && { backgroundColor: dark.green }]} />
          <Text style={styles.sessionTime}>{formatTime(a.start_at)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {a.patient_name}
            </Text>
            <Text style={styles.small}>
              {t(a.mode)} · {t(a.status)}
            </Text>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: dark.page },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md },
  date: { fontSize: 13, color: dark.muted, marginBottom: 2 },
  name: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: dark.text, letterSpacing: 0.2 },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: { fontSize: 26, fontWeight: '700', color: '#FFFFFF' },

  alert: { backgroundColor: '#3A1D1F', borderRadius: 22, padding: spacing.lg, gap: spacing.sm },
  alertChip: {
    backgroundColor: dark.red,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  alertChipText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: spacing.xl, gap: spacing.lg },
  heroLabel: { fontSize: 16, color: dark.onAccent, opacity: 0.85 },
  heroCount: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  heroNumber: { fontSize: 76, lineHeight: 80, fontWeight: '300', color: dark.onAccent, letterSpacing: -2 },
  heroWord: { fontSize: 20, fontWeight: '600', color: dark.onAccent, marginBottom: 12 },
  heroDivider: { height: 1, backgroundColor: 'rgba(20,15,38,0.18)' },
  heroSmall: { fontSize: 13, color: dark.onAccent, opacity: 0.8 },
  heroNext: { fontSize: 17, fontWeight: '600', color: dark.onAccent },
  heroButton: { backgroundColor: '#111114', borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: 13 },
  heroButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  meterWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, height: 110 },
  meterTag: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 18 },
  meterTagText: { fontSize: 14, fontWeight: '700', color: dark.onAccent },
  meterTrack: {
    width: 6,
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'rgba(20,15,38,0.2)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  meterFill: { width: '100%', backgroundColor: dark.onAccent, borderRadius: 3 },

  tiles: { flexDirection: 'row', gap: spacing.md },
  card: { backgroundColor: dark.card, borderRadius: 22, padding: spacing.lg, gap: spacing.md },
  tile: { flex: 1, minHeight: 190, justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: dark.text },
  muted: { fontSize: 14, lineHeight: 19, color: dark.muted },
  small: { fontSize: 13, color: dark.muted },
  link: { fontSize: 15, fontWeight: '600', color: colors.primary },
  tileValue: { fontSize: 36, fontWeight: '700', color: dark.text, letterSpacing: -0.5 },
  track: { height: 6, borderRadius: 3, backgroundColor: dark.raised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  bigMoney: { fontSize: 40, fontWeight: '300', color: dark.text, letterSpacing: -1 },

  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: dark.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', direction: 'ltr' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: dark.muted,
    paddingBottom: 6,
  },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { fontSize: 15, color: dark.text },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary, marginTop: 2 },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#3A3A40' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  sessionBar: { width: 4, height: 36, borderRadius: 2, backgroundColor: colors.primary },
  sessionTime: { width: 72, fontSize: 15, fontWeight: '600', color: dark.text },
  rowTitle: { fontSize: 16, fontWeight: '500', color: dark.text },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: dark.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  countPill: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: { fontSize: 13, fontWeight: '700', color: dark.onAccent },
});
