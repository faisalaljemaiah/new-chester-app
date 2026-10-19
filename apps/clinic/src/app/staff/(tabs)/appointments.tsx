import type { Appointment, AppointmentStatus } from '@chester/shared';
import { colors, radius, spacing } from '@chester/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Choice, Field, Row, Segmented, Sheet, StatusBadge } from '@/components/staff';
import { Button, Card, Empty, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { must, rpc, supabase } from '@/lib/supabase';
import { useMyAppointments } from '@/lib/staff-queries';

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

export default function Appointments() {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const { data, loading } = useMyAppointments(user?.id);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [linkFor, setLinkFor] = useState<Appointment | null>(null);

  const now = Date.now();
  const upcoming = data.filter((a) => a.status === 'scheduled' && Date.parse(a.end_at) > now);
  const past = data.filter((a) => !upcoming.includes(a)).reverse();
  const rows = tab === 'upcoming' ? upcoming : past;

  const setStatus = (id: string, status: AppointmentStatus) =>
    must(supabase.from('appointments').update({ status }).eq('id', id)).catch((e) => showError(t('error'), e));

  const cancel = (a: Appointment) =>
    confirm(`${t('cancelSession')}?`, t('cancelSession'), t('back'), () =>
      rpc('cancel_appointment', { p_appointment: a.id, p_reason: null }).catch((e) => showError(t('error'), e)),
    );

  return (
    <Screen>
      <Text variant="title">{t('navAppointments')}</Text>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: `${t('upcoming')} (${upcoming.length})` },
          { value: 'past', label: t('past') },
        ]}
      />

      {loading && rows.length === 0 && <ActivityIndicator color={colors.primary} />}
      {!loading && rows.length === 0 && <Empty text={t('none')} />}

      {rows.map((a) => {
        const started = Date.parse(a.start_at) <= now;
        return (
          <Card key={a.id} style={{ gap: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">
                  {formatDate(a.start_at)} · {formatTime(a.start_at)}
                </Text>
                <Text variant="small">
                  {t('mode')}: {t(a.mode)}
                </Text>
              </View>
              <StatusBadge status={a.status} />
            </Row>

            <Pressable
              hitSlop={6}
              onPress={() => router.push({ pathname: '/staff/patient/[id]', params: { id: a.patient_id } })}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('patient')}: {a.patient_name}
              </Text>
            </Pressable>

            {a.status === 'scheduled' && (
              <View style={styles.actions}>
                <SmallButton label={t('meetingLink')} variant="secondary" onPress={() => setLinkFor(a)} />
                {started && (
                  <>
                    <SmallButton label={t('markCompleted')} onPress={() => setStatus(a.id, 'completed')} />
                    <SmallButton label={t('markNoShow')} variant="secondary" onPress={() => setStatus(a.id, 'no_show')} />
                  </>
                )}
                {!started && <SmallButton label={t('cancelSession')} variant="danger" onPress={() => cancel(a)} />}
              </View>
            )}

            {/* Let a mistaken outcome be corrected. */}
            {(a.status === 'completed' || a.status === 'no_show') && (
              <Choice<AppointmentStatus>
                label={t('status')}
                value={a.status}
                onChange={(s) => s !== a.status && setStatus(a.id, s)}
                options={[
                  { value: 'completed', label: t('completed') },
                  { value: 'no_show', label: t('no_show') },
                ]}
              />
            )}
          </Card>
        );
      })}

      {linkFor && <MeetingLinkSheet appointment={linkFor} onClose={() => setLinkFor(null)} />}
    </Screen>
  );
}

function MeetingLinkSheet({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(appointment.meeting_url ?? '');
  const [saving, setSaving] = useState(false);
  const valid = /^https:\/\/\S+$/.test(url.trim());

  const save = () => {
    setSaving(true);
    must(supabase.from('appointments').update({ meeting_url: url.trim() }).eq('id', appointment.id))
      .then(onClose)
      .catch((e) => showError(t('error'), e))
      .finally(() => setSaving(false));
  };

  return (
    <Sheet visible title={t('meetingLink')} onClose={onClose}>
      <Text variant="muted">{t('meetingLinkHelp')}</Text>
      <Field
        value={url}
        onChangeText={setUrl}
        placeholder="https://"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={{ writingDirection: 'ltr', textAlign: 'left' }}
      />
      <Button title={t('save')} disabled={!valid} loading={saving} onPress={save} />
    </Sheet>
  );
}

/** Compact action button for list cards (the shared Button is full height). */
function SmallButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const bg = { primary: colors.primary, secondary: colors.surfaceRaised, danger: colors.dangerSoft }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, danger: colors.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.small, { backgroundColor: bg }, pressed && { opacity: 0.75 }]}>
      <Text variant="small" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  small: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
