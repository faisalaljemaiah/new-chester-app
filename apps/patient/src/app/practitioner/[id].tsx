import { colors, isoDateIn, radius, slotsForDate, spacing, timeIn, type Practitioner, type SessionMode } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, Empty, Icon, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { useLive } from '@/lib/hooks';
import { useBookedTimes } from '@/lib/queries';
import { rpc, supabase } from '@/lib/supabase';

const DAYS_AHEAD = 14;

export default function PractitionerScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string; time?: string }>();
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
  if (!p) return <Screen><Empty text="This specialist is no longer available." /></Screen>;

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
      Alert.alert('Could not book', (e as Error).message || 'That time may have just been taken. Pick another.');
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
          <Text variant="title" style={{ fontSize: 20 }}>{p.display_name}</Text>
          <Text variant="muted">{p.title}</Text>
          <Text variant="small">{p.session_minutes} min sessions · {p.time_zone}</Text>
        </View>
      </Card>
      {p.bio ? <Text variant="muted">{p.bio}</Text> : null}

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
      <Button title={time ? `Book ${selectedDate} at ${time}` : 'Pick a time'} onPress={book} disabled={!time} loading={busy} />
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
