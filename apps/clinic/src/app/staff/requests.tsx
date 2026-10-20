import { colors, radius, spacing, type PractitionerChangeRequest } from '@chester/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackHeader, Choice, Row, Segmented, Sheet, StatusBadge } from '@/components/staff';
import { Avatar, Button, Card, Empty, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { showError, showMessage } from '@/lib/dialogs';
import { useI18n } from '@/lib/i18n';
import { rpc } from '@/lib/supabase';
import { useChangeRequests, usePractitioners, useRescheduleRequests } from '@/lib/staff-queries';

/** Patients asking to postpone a session, or to move to another practitioner. */
export default function Requests() {
  const { user, isAdmin } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const [tab, setTab] = useState<'postpone' | 'change'>('postpone');
  const { data: reschedules } = useRescheduleRequests(user?.id, isAdmin);
  const { data: changes } = useChangeRequests(user?.id);
  const { data: practitioners } = usePractitioners();
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<PractitionerChangeRequest | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(null);
    }
  }

  const respond = (id: string, accept: boolean) =>
    run(id, () => rpc('respond_to_reschedule', { p_request: id, p_accept: accept }));

  const decline = (id: string) => run(id, () => rpc('review_practitioner_change', { p_request: id, p_approve: false }));

  async function approve() {
    if (!reviewing || !pick) return;
    const id = reviewing.id;
    setReviewing(null);
    await run(id, async () => {
      const cancelled = await rpc<number>('review_practitioner_change', { p_request: id, p_approve: true, p_to: pick });
      showMessage(t('approved'), `${t('changeApproved')} ${cancelled}`);
    });
  }

  const pendingMoves = reschedules.filter((x) => x.status === 'pending').length;
  const pendingChanges = changes.filter((x) => x.status === 'pending').length;

  return (
    <Screen>
      <BackHeader title={t('navRequests')} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'postpone', label: `${t('postponeRequests')} (${pendingMoves})` },
          { value: 'change', label: `${t('changeRequests')} (${pendingChanges})` },
        ]}
      />

      {tab === 'postpone' && (
        <>
          {reschedules.length === 0 && <Empty text={t('none')} />}
          {reschedules.map((x) => (
            <Card key={x.id} style={{ gap: spacing.md }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Avatar name={x.patient_name} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                    <Text variant="heading">{x.patient_name}</Text>
                    <StatusBadge status={x.status} />
                  </Row>
                  {isAdmin && x.practitioner_id !== user?.id ? (
                    <Text variant="small">{x.practitioner_name}</Text>
                  ) : null}
                  <Text variant="small">
                    {t('bookedFor')}: {formatDate(x.old_start_at)} · {formatTime(x.old_start_at)}
                  </Text>
                  <Text variant="body" style={{ fontWeight: '600' }}>
                    {t('asksToMoveTo')}: {formatDate(x.new_start_at)} · {formatTime(x.new_start_at)}
                  </Text>
                  {x.reason ? (
                    <Text variant="body">
                      <Text variant="muted">{t('reason')}: </Text>
                      {x.reason}
                    </Text>
                  ) : null}
                </View>
              </Row>
              {x.status === 'pending' && (
                <View style={styles.actions}>
                  <SmallButton label={t('accept')} disabled={busy === x.id} onPress={() => respond(x.id, true)} />
                  <SmallButton
                    label={t('decline')}
                    variant="secondary"
                    disabled={busy === x.id}
                    onPress={() => respond(x.id, false)}
                  />
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      {tab === 'change' && (
        <>
          {!isAdmin && <Text variant="small">{t('adminReviews')}</Text>}
          {changes.length === 0 && <Empty text={t('none')} />}
          {changes.map((x) => (
            <Card key={x.id} style={{ gap: spacing.md }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Avatar name={x.patient_name} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                    <Text variant="heading">{x.patient_name}</Text>
                    <StatusBadge status={x.status} />
                  </Row>
                  <Text variant="small">
                    {t('from')} {x.from_practitioner_name ?? '–'} · {t('to')}{' '}
                    {x.to_practitioner_name ?? t('clinicToChoose')}
                    {` · ${formatDate(x.created_at)}`}
                  </Text>
                  <Text variant="body">
                    <Text variant="muted">{t('reason')}: </Text>
                    {x.reason}
                  </Text>
                </View>
              </Row>
              {isAdmin && x.status === 'pending' && (
                <View style={styles.actions}>
                  <SmallButton
                    label={t('approve')}
                    disabled={busy === x.id}
                    onPress={() => {
                      setPick(x.to_practitioner_id);
                      setReviewing(x);
                    }}
                  />
                  <SmallButton
                    label={t('decline')}
                    variant="secondary"
                    disabled={busy === x.id}
                    onPress={() => decline(x.id)}
                  />
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      <Sheet visible={!!reviewing} title={t('approveChange')} onClose={() => setReviewing(null)}>
        {reviewing ? (
          <>
            <Text variant="muted">
              {reviewing.patient_name} · {t('from')} {reviewing.from_practitioner_name ?? '–'}
            </Text>
            <Choice
              label={t('choosePractitioner')}
              value={pick}
              onChange={setPick}
              options={practitioners
                .filter((p) => p.id !== reviewing.from_practitioner_id)
                .map((p) => ({ value: p.id, label: p.display_name }))}
            />
            <Button title={t('approveChange')} onPress={approve} disabled={!pick} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

/** Compact action button for list cards (the shared Button is full height). */
function SmallButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const bg = variant === 'primary' ? colors.primary : colors.surfaceRaised;
  const fg = variant === 'primary' ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        pressed && { opacity: 0.75 },
      ]}>
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
