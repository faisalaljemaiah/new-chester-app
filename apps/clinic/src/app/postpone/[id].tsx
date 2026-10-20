import { colors, isoDateIn, slotsForDate, spacing, timeIn, type Appointment, type Practitioner } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/staff';
import { Button, Card, Chip, Empty, Icon, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { showError, showMessage } from '@/lib/dialogs';
import { formatDate, formatHours, formatTime } from '@/lib/format';
import { useLive } from '@/lib/hooks';
import { useBookedTimes } from '@/lib/queries';
import { rpc, supabase } from '@/lib/supabase';

const DAYS_AHEAD = 14;

/** Ask the practitioner to move a session to another free time. The session stays put until they accept. */
export default function PostponeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: a, loading } = useLive<Appointment>(
    `appointment:${id}`,
    () => supabase.from('appointments').select('*').eq('id', id).maybeSingle(),
    ['appointments'],
  );
  // Read the id outside the query: the React Compiler would otherwise read a.practitioner_id while `a` is still null.
  const practitionerId = a?.practitioner_id;
  const { data: p } = useLive<Practitioner>(
    practitionerId ? `practitioner:${practitionerId}` : null,
    () => supabase.from('practitioners').select('*').eq('id', practitionerId!).maybeSingle(),
    ['practitioners'],
  );

  const days = useMemo(() => {
    if (!p) return [];
    return Array.from({ length: DAYS_AHEAD }, (_, i) => isoDateIn(new Date(Date.now() + i * 86_400_000), p.time_zone));
  }, [p]);
  const [date, setDate] = useState<string>();
  const [time, setTime] = useState<string>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedDate = date ?? days[0];
  const { data: booked } = useBookedTimes(p && selectedDate ? practitionerId : undefined, selectedDate ?? '');
  const slots = useMemo(() => {
    if (!p || !selectedDate) return [];
    const all = slotsForDate(p, selectedDate, booked);
    if (selectedDate !== isoDateIn(new Date(), p.time_zone)) return all;
    const now = timeIn(new Date(), p.time_zone);
    return all.filter((s) => s.time > now);
  }, [p, selectedDate, booked]);

  if (loading) return <Loading />;
  if (!a || a.status !== 'scheduled')
    return (
      <Screen>
        <Empty text="This session can't be postponed." />
      </Screen>
    );

  async function send() {
    if (!selectedDate || !time) return;
    setBusy(true);
    try {
      await rpc('request_reschedule', {
        p_appointment: id,
        p_date: selectedDate,
        p_time: time,
        p_reason: reason.trim() || null,
      });
      showMessage('Request sent', `${a!.practitioner_name} will confirm the new time.`);
      router.back();
    } catch (e) {
      showError('Could not send the request', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Icon ios="chevron.left" material="arrow_back" />
      </Pressable>
      <Text variant="title">Postpone your session</Text>

      <Card style={{ gap: 4 }}>
        <Text variant="small">Currently booked with {a.practitioner_name}</Text>
        <Text variant="heading">
          {formatDate(a.start_at)} · {formatTime(a.start_at)}
        </Text>
        {p
          ? formatHours(p.weekly_hours).map((line) => (
              <Text key={line} variant="small">
                Works {line}
              </Text>
            ))
          : null}
      </Card>

      <SectionHeader title="Pick a new day" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00Z`);
          return (
            <Chip
              key={d}
              label={dt.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' })}
              sublabel={dt.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}
              selected={d === selectedDate}
              onPress={() => {
                setDate(d);
                setTime(undefined);
              }}
            />
          );
        })}
      </ScrollView>

      <SectionHeader title="Free times" />
      {slots.length === 0 ? (
        <Empty text="No free times on this day." />
      ) : (
        <View style={styles.grid}>
          {slots.map((s) => (
            <Chip key={s.time} label={s.time} selected={s.time === time} onPress={() => setTime(s.time)} />
          ))}
        </View>
      )}

      <Field
        label="Reason (optional)"
        placeholder="Let your practitioner know why"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={2000}
      />
      <Text variant="small" style={{ color: colors.textMuted }}>
        Your session stays at its current time until your practitioner accepts the new one.
      </Text>
      <Button
        title={time ? `Ask to move to ${selectedDate} at ${time}` : 'Pick a time'}
        onPress={send}
        disabled={!time}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
