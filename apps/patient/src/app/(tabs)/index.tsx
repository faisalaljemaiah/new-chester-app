import { colors, isoDateIn, radius, slotsForDate, spacing, timeIn, type Practitioner } from '@chester/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Card, Chip, Empty, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { firstName, formatDate, formatTime, greeting } from '@/lib/format';
import { useBookedTimes, useMyAppointments, usePractitioners } from '@/lib/queries';

const services = [
  { key: 'psychiatry', label: 'Psychiatry', ios: 'cross.case', material: 'medication' },
  { key: 'psychology', label: 'Psychology', ios: 'brain.head.profile', material: 'psychology' },
  { key: 'messages', label: 'Messages', ios: 'bubble.left', material: 'chat_bubble' },
  { key: 'forms', label: 'Check-ins', ios: 'list.clipboard', material: 'assignment' },
] as const;

export default function Home() {
  const { user, patient } = useAuth();
  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState<Practitioner['discipline'] | null>(null);
  const { data: practitioners } = usePractitioners();
  const { data: appointments } = useMyAppointments(user?.id);

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'scheduled' && Date.parse(a.end_at) > Date.now())
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0],
    [appointments],
  );

  const shown = practitioners.filter(
    (p) =>
      (!discipline || p.discipline === discipline) &&
      (!search || `${p.display_name} ${p.title}`.toLowerCase().includes(search.toLowerCase())),
  );

  // "Available today" uses the patient's main practitioner, or the first one listed.
  const featured = practitioners.find((p) => p.id === patient?.primary_practitioner_id) ?? practitioners[0];
  const today = featured ? isoDateIn(new Date(), featured.time_zone) : '';
  const { data: booked } = useBookedTimes(featured?.id, today);
  const todaySlots = useMemo(() => {
    if (!featured || !today) return [];
    const now = timeIn(new Date(), featured.time_zone);
    return slotsForDate(featured, today, booked).filter((s) => s.time > now).slice(0, 8);
  }, [featured, today, booked]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="muted">{greeting()},</Text>
          <Text variant="title">{firstName(patient?.display_name) || 'there'} 👋</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <Avatar name={patient?.display_name ?? '?'} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Icon ios="magnifyingglass" material="search" color={colors.textFaint} size={18} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search psychiatrists or psychologists..."
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
      </View>

      <SectionHeader title="Our Services" />
      <View style={styles.services}>
        {services.map((s) => {
          const active = discipline === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.service, active && { backgroundColor: colors.primary }]}
              onPress={() => {
                if (s.key === 'messages') return router.push('/(tabs)/messages');
                if (s.key === 'forms') return router.push('/(tabs)/profile');
                setDiscipline(active ? null : s.key);
              }}>
              <Icon ios={s.ios} material={s.material} color={active ? colors.onPrimary : colors.primary} />
              <Text variant="small" style={{ color: active ? colors.onPrimary : colors.text, textAlign: 'center' }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Upcoming Appointment" />
      {upcoming ? (
        <Card onPress={() => router.push(`/session/${upcoming.id}`)} style={styles.row}>
          <Avatar name={upcoming.practitioner_name} size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{upcoming.practitioner_name}</Text>
            <Text variant="small">
              {formatDate(upcoming.start_at)} · {formatTime(upcoming.start_at)}
            </Text>
          </View>
          <Icon ios="chevron.right" material="chevron_right" color={colors.textMuted} size={18} />
        </Card>
      ) : (
        <Empty text="No upcoming sessions yet. Book one below." />
      )}

      {featured && todaySlots.length > 0 && (
        <>
          <SectionHeader title="Available Today" action={featured.display_name} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {todaySlots.map((s) => (
              <Chip
                key={s.time}
                label={s.time}
                onPress={() => router.push({ pathname: '/practitioner/[id]', params: { id: featured.id, date: s.date, time: s.time } })}
              />
            ))}
          </ScrollView>
        </>
      )}

      <SectionHeader title="Our Specialists" />
      {shown.length === 0 ? <Empty text="No specialists match your search." /> : null}
      {shown.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/practitioner/${p.id}`)} style={styles.row}>
          <Avatar name={p.display_name} uri={p.photo_url} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{p.display_name}</Text>
            <Text variant="small">{p.title}</Text>
          </View>
          <View style={styles.tag}>
            <Text variant="small" style={{ color: colors.primary }}>
              {p.discipline === 'psychiatry' ? 'Psychiatry' : 'Psychology'}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  services: { flexDirection: 'row', gap: spacing.sm },
  service: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
