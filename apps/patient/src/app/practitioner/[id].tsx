import { colors, isoDateIn, radius, slotsForDate, spacing, timeIn, type Practitioner, type SessionMode } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Chip, Empty, Icon, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { api } from '@/lib/firebase';
import { useDocument } from '@/lib/hooks';

const DAYS_AHEAD = 14;

export default function PractitionerScreen() {
  const params = useLocalSearchParams<{ id: string; date?: string; time?: string }>();
  const { data: p, loading } = useDocument<Practitioner>(`practitioners/${params.id}`);

  const days = useMemo(() => {
    if (!p) return [];
    return Array.from({ length: DAYS_AHEAD }, (_, i) => isoDateIn(new Date(Date.now() + i * 86_400_000), p.timeZone));
  }, [p]);

  const [date, setDate] = useState<string | undefined>(params.date);
  const [time, setTime] = useState<string | undefined>(params.time);
  const [mode, setMode] = useState<SessionMode>('video');
  const [busy, setBusy] = useState(false);

  const selectedDate = date ?? days[0];
  const { data: booked } = useDocument<{ times: string[] }>(
    p && selectedDate ? `bookedSlots/${params.id}_${selectedDate}` : null,
  );

  const slots = useMemo(() => {
    if (!p || !selectedDate) return [];
    const all = slotsForDate(p, selectedDate, booked?.times ?? []);
    if (selectedDate !== isoDateIn(new Date(), p.timeZone)) return all;
    const now = timeIn(new Date(), p.timeZone);
    return all.filter((s) => s.time > now);
  }, [p, selectedDate, booked]);

  if (loading) return <Loading />;
  if (!p) return <Screen><Empty text="This specialist is no longer available." /></Screen>;

  async function book() {
    if (!selectedDate || !time) return;
    setBusy(true);
    try {
      const { data } = await api.bookAppointment({ practitionerId: params.id, date: selectedDate, time, mode });
      router.replace(`/session/${data.appointmentId}`);
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
        <Avatar name={p.displayName} uri={p.photoUrl} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" style={{ fontSize: 20 }}>{p.displayName}</Text>
          <Text variant="muted">{p.title}</Text>
          <Text variant="small">{p.sessionMinutes} min sessions · {p.timeZone}</Text>
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

      <Text variant="small">Times are shown in the specialist's time zone ({p.timeZone}).</Text>
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
