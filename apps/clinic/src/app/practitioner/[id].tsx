import {
  colors,
  isoDateIn,
  radius,
  slotsForDate,
  spacing,
  timeIn,
  type Practitioner,
  type SessionMode,
} from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, Empty, Icon, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/dialogs';
import { formatHours } from '@/lib/format';
import { useLive } from '@/lib/hooks';
import { useBookedTimes } from '@/lib/queries';
import { rpc, supabase } from '@/lib/supabase';

const DAYS_AHEAD = 14;

export default function PractitionerScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string; time?: string }>();
  const { patient } = useAuth();
  const { data: p, loading } = useLive<Practitioner>(
    `practitioner:${params.id}`,
    () => supabase.from('practitioners').select('*').eq('id', params.id).maybeSingle(),
    ['practitioners'],
  );

  const days = useMemo(() => {
    if (!p) return [];
    return Array.from({ length: DAYS_AHEAD }, (_, i) => isoDateIn(new Date(Date.now() + i * 86_400_000), p.time_zone));
  }, [p]);

  const [date, setDate] = useState<string | undefined>(params.date);
  const [time, setTime] = useState<string | undefined>(params.time);
  const [mode, setMode] = useState<SessionMode>('video');
  const [busy, setBusy] = useState(false);

  const selectedDate = date ?? days[0];
  const { data: booked } = useBookedTimes(p && selectedDate ? params.id : undefined, selectedDate ?? '');

  const slots = useMemo(() => {
    if (!p || !selectedDate) return [];
    const all = slotsForDate(p, selectedDate, booked);
    if (selectedDate !== isoDateIn(new Date(), p.time_zone)) return all;
    const now = timeIn(new Date(), p.time_zone);
    return all.filter((s) => s.time > now);
  }, [p, selectedDate, booked]);

  if (loading) return <Loading />;
  if (!p)
    return (
      <Screen>
        <Empty text="This specialist is no longer available." />
      </Screen>
    );
  // Patients stay with the practitioner they first booked; seeing someone else goes through a change request.
  const committedElsewhere = !!patient?.primary_practitioner_id && patient.primary_practitioner_id !== p.id;

  async function book() {
    if (!selectedDate || !time) return;
    setBusy(true);
    try {
      const appointmentId = await rpc<string>('book_appointment', {
        p_practitioner: params.id,
        p_date: selectedDate,
        p_time: time,
        p_mode: mode,
      });
      router.replace(`/session/${appointmentId}`);
    } catch (e) {
      showError('Could not book', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Icon ios="chevron.left" material="arrow_back" />
      </Pressable>

      <Card style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <Avatar name={p.display_name} uri={p.photo_url} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" style={{ fontSize: 20 }}>
            {p.display_name}
          </Text>
          <Text variant="muted">{p.title}</Text>
          <Text variant="small">
            {p.session_minutes} min sessions · {p.time_zone}
          </Text>
        </View>
      </Card>
      {p.bio ? <Text variant="muted">{p.bio}</Text> : null}

      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon ios="clock" material="schedule" color={colors.primary} size={18} />
          <Text variant="heading">Working hours</Text>
        </View>
        {formatHours(p.weekly_hours).map((line) => (
          <Text key={line}>{line}</Text>
        ))}
        {formatHours(p.weekly_hours).length === 0 ? <Text variant="muted">No hours set yet.</Text> : null}
      </Card>

      {committedElsewhere ? (
        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">You already have a practitioner</Text>
          <Text variant="muted">
            To keep your care consistent, you see the same practitioner each time. If you'd like to see {p.display_name}{' '}
            instead, send the clinic a request.
          </Text>
          <Button
            title={`Request a change to ${p.display_name}`}
            onPress={() => router.push({ pathname: '/change-practitioner', params: { to: p.id } })}
          />
        </Card>
      ) : (
        <>
          <SectionHeader title="Pick a day" />
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

          <SectionHeader title="Available times" />
          {slots.length === 0 ? (
            <Empty text="No free times on this day." />
          ) : (
            <View style={styles.grid}>
              {slots.map((s) => (
                <Chip key={s.time} label={s.time} selected={s.time === time} onPress={() => setTime(s.time)} />
              ))}
            </View>
          )}

          <SectionHeader title="Session type" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['video', 'audio', 'chat'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.mode, mode === m && styles.modeActive]}>
                <Text style={{ color: mode === m ? colors.onPrimary : colors.text, fontWeight: '600' }}>
                  {m === 'video' ? 'Video' : m === 'audio' ? 'Voice' : 'Chat'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text variant="small">Times are shown in the specialist's time zone ({p.time_zone}).</Text>
          <Button
            title={time ? `Book ${selectedDate} at ${time}` : 'Pick a time'}
            onPress={book}
            disabled={!time}
            loading={busy}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  modeActive: { backgroundColor: colors.primary },
});
