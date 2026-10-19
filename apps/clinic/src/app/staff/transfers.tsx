import { colors, radius, spacing } from '@chester/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { BackHeader, Row, Segmented, StatusBadge } from '@/components/staff';
import { Avatar, Card, Empty, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { must, rpc, supabase } from '@/lib/supabase';
import { useTransfers } from '@/lib/staff-queries';

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

/** Patient handovers: incoming ones to accept or decline, outgoing ones to withdraw. */
export default function Transfers() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const { data: incoming } = useTransfers(user?.id, 'to_practitioner_id');
  const { data: outgoing } = useTransfers(user?.id, 'from_practitioner_id');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = tab === 'incoming' ? incoming : outgoing;

  async function respond(transferId: string, accept: boolean) {
    setBusy(transferId);
    try {
      await rpc('respond_to_transfer', { p_transfer: transferId, p_accept: accept });
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(null);
    }
  }

  const withdraw = (id: string) =>
    confirm(`${t('withdraw')}?`, t('withdraw'), t('back'), () =>
      must(supabase.from('transfers').update({ status: 'cancelled' }).eq('id', id)).catch((e) => showError(t('error'), e)),
    );

  return (
    <Screen>
      <BackHeader title={t('navTransfers')} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'incoming', label: `${t('incoming')} (${incoming.filter((x) => x.status === 'pending').length})` },
          { value: 'outgoing', label: t('outgoing') },
        ]}
      />

      {rows.length === 0 && <Empty text={t('none')} />}
      {rows.map((x) => (
        <Card key={x.id} style={{ gap: spacing.md }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Avatar name={x.patient_name} />
            <View style={{ flex: 1, gap: 4 }}>
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                <Text variant="heading">{x.patient_name}</Text>
                <StatusBadge status={x.status} />
              </Row>
              <Text variant="small">
                {tab === 'incoming' ? `${t('from')} ${x.from_practitioner_name}` : `${t('to')} ${x.to_practitioner_name}`}
                {` · ${formatDate(x.created_at)}`}
              </Text>
              <Text variant="body">
                <Text variant="muted">{t('reason')}: </Text>
                {x.reason}
              </Text>
            </View>
          </Row>

          {tab === 'incoming' && x.status === 'pending' && (
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
          {tab === 'incoming' && x.status === 'accepted' && (
            <View style={styles.actions}>
              <SmallButton
                label={t('openFile')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/staff/patient/[id]', params: { id: x.patient_id } })}
              />
            </View>
          )}
          {tab === 'outgoing' && x.status === 'pending' && (
            <View style={styles.actions}>
              <SmallButton label={t('withdraw')} variant="secondary" onPress={() => withdraw(x.id)} />
            </View>
          )}
        </Card>
      ))}
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
