import { colors, radius, spacing, type AppointmentStatus } from '@chester/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, Empty, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/format';
import { useMyAppointments } from '@/lib/queries';

const statusLabel: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

export default function Appointments() {
  const { user } = useAuth();
  const { data, loading } = useMyAppointments(user?.uid);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const now = Date.now();
  const upcoming = data
    .filter((a) => a.status === 'scheduled' && a.end.toMillis() > now)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const past = data.filter((a) => !upcoming.includes(a));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen>
      <Text variant="title">Appointments</Text>
      <View style={styles.segment}>
        {(['upcoming', 'past'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && styles.segmentActive]}>
            <Text style={{ color: tab === t ? colors.onPrimary : colors.textMuted, fontWeight: '600' }}>
              {t === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </Pressable>
        ))}
      </View>

      {!loading && list.length === 0 && (
        <Empty text={tab === 'upcoming' ? 'No upcoming sessions.' : 'No past sessions yet.'} />
      )}
      {list.map((a) => (
        <Card key={a.id} onPress={() => router.push(`/session/${a.id}`)} style={styles.row}>
          <Avatar name={a.practitionerName} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{a.practitionerName}</Text>
            <Text variant="small">
              {formatDate(a.start)} · {formatTime(a.start)} · {a.mode}
            </Text>
          </View>
          <Text variant="small" style={{ color: a.status === 'scheduled' ? colors.primary : colors.textMuted }}>
            {statusLabel[a.status]}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
