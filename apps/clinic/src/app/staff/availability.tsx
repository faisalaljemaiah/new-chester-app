import { colors, spacing } from '@chester/shared';
import type { AvailabilityKind, AvailabilityRequest, Practitioner, WeeklyHours } from '@chester/shared';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';

import { BackHeader, Choice, Field, Row, StatusBadge } from '@/components/staff';
import { Button, Card, Chip, Empty, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { useMyAvailabilityRequests, usePendingAvailabilityRequests } from '@/lib/staff-queries';
import { must, rpc, supabase } from '@/lib/supabase';

const DAY_KEYS: MessageKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Sunday-to-Saturday week containing today, offset by whole weeks. */
function weekRange(offsetWeeks: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offsetWeeks * 7));
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { from: iso(start), to: iso(end) };
}

/** Shows an error; Alert has no UI on web. */
function showError(title: string, e: unknown) {
  const message = (e as Error)?.message ?? String(e);
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

/** Asks before a destructive action. */
function confirm(title: string, ok: string, back: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onOk();
    return;
  }
  Alert.alert(title, undefined, [
    { text: back, style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

/** Time off and extra days, the weekly hours patients can book, and (for admins) the review queue. */
export default function Availability() {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  return (
    <Screen>
      <BackHeader title={t('navAvailability')} />
      {isAdmin ? <ReviewQueue /> : null}
      <NewRequest />
      <MyRequests />
      <WeeklyHoursEditor />
    </Screen>
  );
}

/** "from → to · 09:00–17:00", always left to right. */
function RangeText({ r }: { r: AvailabilityRequest }) {
  return (
    <Text variant="small" style={styles.ltr}>
      {r.from_date} → {r.to_date}
      {r.hours ? ` · ${r.hours.start}–${r.hours.end}` : ''}
    </Text>
  );
}

function NewRequest() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [kind, setKind] = useState<AvailabilityKind>('unavailable');
  const [range, setRange] = useState(weekRange(0));
  const [hours, setHours] = useState({ start: '09:00', end: '17:00' });
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const validRange = isDate(range.from) && isDate(range.to) && range.from <= range.to;
  const validHours = kind === 'unavailable' || (isTime(hours.start) && isTime(hours.end));

  async function submit() {
    if (!user) return;
    setBusy(true);
    try {
      // practitioner_id, its name and the status are filled in by the database.
      await must(
        supabase.from('availability_requests').insert({
          kind,
          from_date: range.from,
          to_date: range.to,
          hours: kind === 'available' ? hours : null,
          note: note.trim() || null,
        }),
      );
      setNote('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeader title={t('newRequest')} />
      <Card style={styles.stack}>
        <Choice
          value={kind}
          options={[
            { value: 'unavailable', label: t('notAvailable') },
            { value: 'available', label: t('availableExtra') },
          ]}
          onChange={setKind}
        />
        <Row gap={spacing.sm}>
          <Chip label={t('thisWeek')} onPress={() => setRange(weekRange(0))} />
          <Chip label={t('nextWeek')} onPress={() => setRange(weekRange(1))} />
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field
              label={t('fromDate')}
              value={range.from}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              onChangeText={(from) => setRange({ ...range, from })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('toDate')}
              value={range.to}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              onChangeText={(to) => setRange({ ...range, to })}
            />
          </View>
        </Row>
        {kind === 'available' ? (
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label={t('hoursFrom')}
                value={hours.start}
                placeholder="HH:MM"
                onChangeText={(start) => setHours({ ...hours, start })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label={t('hoursTo')}
                value={hours.end}
                placeholder="HH:MM"
                onChangeText={(end) => setHours({ ...hours, end })}
              />
            </View>
          </Row>
        ) : null}
        <Field label={t('note')} value={note} onChangeText={setNote} />
        <Button
          title={sent ? `✓ ${t('saved')}` : t('submitRequest')}
          loading={busy}
          disabled={!validRange || !validHours}
          onPress={() => void submit()}
        />
      </Card>
    </>
  );
}

function MyRequests() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data } = useMyAvailabilityRequests(user?.id);

  const withdraw = (id: string) =>
    confirm(`${t('withdraw')}?`, t('withdraw'), t('cancel'), () => {
      must(supabase.from('availability_requests').delete().eq('id', id)).catch((e) => showError(t('error'), e));
    });

  return (
    <>
      <SectionHeader title={t('myRequests')} />
      {data.length === 0 ? <Empty text={t('none')} /> : null}
      {data.map((r) => (
        <Card key={r.id} style={styles.stack}>
          <Row>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{r.kind === 'unavailable' ? t('notAvailable') : t('availableExtra')}</Text>
              <RangeText r={r} />
            </View>
            <StatusBadge status={r.status} />
          </Row>
          {r.status === 'pending' ? (
            <Button title={t('withdraw')} variant="secondary" onPress={() => withdraw(r.id)} />
          ) : null}
        </Card>
      ))}
    </>
  );
}

function ReviewQueue() {
  const { t } = useI18n();
  const { data } = usePendingAvailabilityRequests(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function review(requestId: string, approve: boolean) {
    setBusy(requestId);
    try {
      // Returns how many booked sessions clash with the approved request.
      const affected = await rpc<number>('review_availability_request', { p_request: requestId, p_approve: approve });
      setWarning(affected > 0 ? `${affected} ${t('affectedSessions')}` : null);
    } catch (e) {
      setWarning((e as Error).message || t('error'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SectionHeader title={t('requestsToReview')} />
      {warning ? (
        <Card style={styles.warning}>
          <Text style={{ color: colors.warning }}>{warning}</Text>
        </Card>
      ) : null}
      {data.length === 0 ? <Empty text={t('none')} /> : null}
      {data.map((r) => (
        <Card key={r.id} style={styles.stack}>
          <View style={{ gap: 2 }}>
            <Text variant="heading">{r.practitioner_name}</Text>
            <Text variant="muted">{r.kind === 'unavailable' ? t('notAvailable') : t('availableExtra')}</Text>
            <RangeText r={r} />
            {r.note ? <Text>{r.note}</Text> : null}
          </View>
          <Row>
            <View style={{ flex: 1 }}>
              <Button title={t('approve')} disabled={busy === r.id} onPress={() => void review(r.id, true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('reject')}
                variant="secondary"
                disabled={busy === r.id}
                onPress={() => void review(r.id, false)}
              />
            </View>
          </Row>
        </Card>
      ))}
    </>
  );
}

function WeeklyHoursEditor() {
  const { user, practitioner } = useAuth();
  const { t } = useI18n();
  const [hours, setHours] = useState<WeeklyHours>({});
  const [sessionMinutes, setSessionMinutes] = useState('50');
  const [timeZone, setTimeZone] = useState('Asia/Riyadh');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!practitioner) return;
    setHours(practitioner.weekly_hours ?? {});
    setSessionMinutes(String(practitioner.session_minutes ?? 50));
    setTimeZone(practitioner.time_zone ?? 'Asia/Riyadh');
  }, [practitioner]);

  if (!practitioner || !user) return null;

  const setDay = (day: number, value: { start: string; end: string } | null) =>
    setHours((h) => ({ ...h, [String(day)]: value ? [value] : [] }));

  // Same limits as the web number input (15–180 minutes), and every open day needs valid times.
  const minutes = Number(sessionMinutes);
  const valid =
    Number.isInteger(minutes) &&
    minutes >= 15 &&
    minutes <= 180 &&
    timeZone.trim() !== '' &&
    Object.values(hours).every((w) => !w?.[0] || (isTime(w[0].start) && isTime(w[0].end)));

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      const update: Partial<Practitioner> = { weekly_hours: hours, session_minutes: minutes, time_zone: timeZone.trim() };
      await must(supabase.from('practitioners').update(update).eq('id', user.id));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeader title={t('weeklyHours')} />
      <Card style={styles.stack}>
        <Text variant="muted">{t('weeklyHoursHelp')}</Text>
        {DAY_KEYS.map((key, day) => {
          const slot = hours[String(day)]?.[0];
          return (
            <View key={key} style={{ gap: spacing.sm }}>
              <Row>
                <Text variant="heading" style={{ flex: 1 }}>
                  {t(key)}
                </Text>
                <Switch
                  value={!!slot}
                  onValueChange={(on) => setDay(day, on ? { start: '09:00', end: '17:00' } : null)}
                  trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
                />
              </Row>
              {slot ? (
                <Row>
                  <View style={{ flex: 1 }}>
                    <Field
                      value={slot.start}
                      placeholder="HH:MM"
                      onChangeText={(start) => setDay(day, { ...slot, start })}
                    />
                  </View>
                  <Text variant="muted">–</Text>
                  <View style={{ flex: 1 }}>
                    <Field value={slot.end} placeholder="HH:MM" onChangeText={(end) => setDay(day, { ...slot, end })} />
                  </View>
                </Row>
              ) : null}
            </View>
          );
        })}
        <Field
          label={t('sessionLength')}
          value={sessionMinutes}
          keyboardType="number-pad"
          onChangeText={setSessionMinutes}
        />
        <Field
          label={t('timeZone')}
          value={timeZone}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setTimeZone}
        />
        <Button
          title={saved ? `✓ ${t('saved')}` : t('save')}
          loading={busy}
          disabled={!valid}
          onPress={() => void save()}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  ltr: { writingDirection: 'ltr' },
  warning: { borderColor: colors.warning },
});
