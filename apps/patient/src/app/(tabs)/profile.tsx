import { colors, radius, spacing } from '@chester/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Empty, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useMyAppointments, useMyAssessments } from '@/lib/queries';

export default function Profile() {
  const { user, patient, signOut } = useAuth();
  const { data: appointments } = useMyAppointments(user?.id);
  const { data: assessments } = useMyAssessments(user?.id);

  const completed = appointments.filter((a) => a.status === 'completed').length;
  const upcoming = appointments.filter((a) => a.status === 'scheduled' && Date.parse(a.end_at) > Date.now()).length;
  const pending = assessments.filter((a) => a.status === 'sent');
  const done = assessments.filter((a) => a.status === 'completed');

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Avatar name={patient?.display_name ?? '?'} size={84} />
        <Text variant="title">{patient?.display_name}</Text>
        <Text variant="muted">{user?.email}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stat label="Sessions done" value={completed} />
        <Stat label="Upcoming" value={upcoming} />
        <Stat label="Check-ins" value={done.length} />
      </View>

      <SectionHeader title="Check-ins to complete" />
      {pending.length === 0 && <Empty text="Nothing to fill in right now." />}
      {pending.map((a) => (
        <Card
          key={a.id}
          onPress={() => router.push(`/assessment/${a.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={styles.formIcon}>
            <Icon ios="list.clipboard" material="assignment" color={colors.primary} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{a.form_title}</Text>
            <Text variant="small">Sent {formatDate(a.sent_at)}</Text>
          </View>
          <Icon ios="chevron.right" material="chevron_right" color={colors.textMuted} size={18} />
        </Card>
      ))}

      {done.length > 0 && (
        <>
          <SectionHeader title="Completed check-ins" />
          {done.map((a) => (
            <Card key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text>{a.form_code}</Text>
              <Text variant="small">{a.completed_at ? formatDate(a.completed_at) : ''}</Text>
            </Card>
          ))}
        </>
      )}

      <View style={{ height: spacing.lg }} />
      <Button title="Sign Out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text variant="title" style={{ color: colors.primary }}>
        {value}
      </Text>
      <Text variant="small" style={{ textAlign: 'center' }}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  formIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
