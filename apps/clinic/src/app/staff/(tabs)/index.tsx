import { colors, radius, spacing } from '@chester/shared';
import { router, type Href } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Row, SeverityBadge } from '@/components/staff';
import { Avatar, Card, Empty, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMyAppointments, useMyPatients, useMyResults, useTransfers } from '@/lib/staff-queries';

const openPatient = (id: string, tab?: string) =>
  router.push({ pathname: '/staff/patient/[id]', params: tab ? { id, tab } : { id } });

/** Overview: today's sessions, safety alerts, new results and pending transfers. */
export default function Overview() {
  const { user, practitioner } = useAuth();
  const { t, locale, formatTime, formatDate } = useI18n();
  const { data: appointments } = useMyAppointments(user?.id);
  const { data: transfers } = useTransfers(user?.id, 'to_practitioner_id');
  const { data: results } = useMyResults(user?.id);
  const { data: patients } = useMyPatients(user?.id);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 86_400_000;
  const scheduled = appointments.filter((a) => a.status === 'scheduled');
  const today = scheduled.filter((a) => Date.parse(a.start_at) >= startOfDay && Date.parse(a.start_at) < endOfDay);
  const upcoming = scheduled.filter((a) => Date.parse(a.start_at) >= endOfDay).slice(0, 5);
  const pendingTransfers = transfers.filter((x) => x.status === 'pending');
  const unreviewed = results.filter((r) => !r.reviewed);
  const flagged = unreviewed.filter((r) => r.safety_flag);
  const patientName = (id: string) => patients.find((p) => p.id === id)?.display_name ?? '—';

  const hour = now.getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 18 ? t('goodAfternoon') : t('goodEvening');
  const name = (locale === 'ar' && practitioner?.display_name_ar) || practitioner?.display_name || '';

  return (
    <Screen>
      <View>
        <Text variant="muted">{formatDate(now)}</Text>
        <Text variant="title">
          {greeting}, {name}
        </Text>
      </View>

      {flagged.length > 0 && (
        <View style={styles.alert}>
          <Text variant="heading" style={{ color: colors.danger }}>
            {t('safetyAlerts')} ({flagged.length})
          </Text>
          <Text>{t('safetyAlertHelp')}</Text>
          <View style={styles.wrap}>
            {flagged.map((r) => (
              <Pressable
                key={r.assignment_id}
                style={({ pressed }) => [styles.alertButton, pressed && { opacity: 0.75 }]}
                onPress={() => openPatient(r.patient_id, 'assessments')}>
                <Text variant="small" style={{ color: colors.onPrimary, fontWeight: '600' }}>
                  {patientName(r.patient_id)} · {r.form_code}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.stats}>
        <Stat label={t('todaySessions')} value={today.length} />
        <Stat label={t('pendingTransfers')} value={pendingTransfers.length} href="/staff/transfers" />
        <Stat label={t('newResults')} value={unreviewed.length} href="/staff/assessments" />
        <Stat label={t('navPatients')} value={patients.length} href="/staff/patients" />
      </View>

      <SectionHeader title={t('todaySessions')} />
      {today.length === 0 && <Empty text={t('noSessionsToday')} />}
      {today.map((a) => (
        <Card key={a.id} onPress={() => openPatient(a.patient_id)}>
          <Row>
            <Avatar name={a.patient_name} />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{a.patient_name}</Text>
              <Text variant="small">
                {formatTime(a.start_at)} · {t(a.mode)}
              </Text>
            </View>
            {a.meeting_url ? (
              <Pressable style={styles.smallButton} hitSlop={6} onPress={() => void Linking.openURL(a.meeting_url!)}>
                <Text variant="small" style={{ color: colors.onPrimary, fontWeight: '600' }}>
                  {t('video')}
                </Text>
              </Pressable>
            ) : null}
          </Row>
        </Card>
      ))}

      <SectionHeader title={t('upcomingSessions')} action={t('all')} onAction={() => router.push('/staff/appointments')} />
      {upcoming.length === 0 && <Empty text={t('none')} />}
      {upcoming.map((a) => (
        <Card key={a.id}>
          <Row>
            <Avatar name={a.patient_name} />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{a.patient_name}</Text>
              <Text variant="small">
                {formatDate(a.start_at)} · {formatTime(a.start_at)}
              </Text>
            </View>
          </Row>
        </Card>
      ))}

      <SectionHeader title={t('newResults')} action={t('all')} onAction={() => router.push('/staff/assessments')} />
      {unreviewed.length === 0 && <Empty text={t('none')} />}
      {unreviewed.slice(0, 5).map((r) => (
        <Card key={r.assignment_id} onPress={() => openPatient(r.patient_id, 'assessments')}>
          <Row>
            <Avatar name={patientName(r.patient_id)} />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{patientName(r.patient_id)}</Text>
              <Text variant="small">
                {r.form_code} · {t('score')} {r.score}/{r.max_score}
              </Text>
            </View>
            <SeverityBadge level={r.severity_level} label={r.severity} />
          </Row>
        </Card>
      ))}

      <SectionHeader title={t('pendingTransfers')} action={t('all')} onAction={() => router.push('/staff/transfers')} />
      {pendingTransfers.length === 0 && <Empty text={t('none')} />}
      {pendingTransfers.map((x) => (
        <Card key={x.id} onPress={() => router.push('/staff/transfers')}>
          <Row>
            <Avatar name={x.patient_name} />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{x.patient_name}</Text>
              <Text variant="small">
                {t('from')} {x.from_practitioner_name}
              </Text>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

/** Count tile; tapping it opens the matching screen when there is one. */
function Stat({ label, value, href }: { label: string; value: number; href?: Href }) {
  return (
    <Card style={styles.stat} onPress={href ? () => router.push(href) : undefined}>
      <Text variant="title">{value}</Text>
      <Text variant="small">{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  alert: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  alertButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 4 },
  smallButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
