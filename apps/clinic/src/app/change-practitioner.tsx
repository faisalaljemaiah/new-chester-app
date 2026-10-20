import { colors, radius, spacing } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { Field } from '@/components/staff';
import { Avatar, Button, Card, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { showError, showMessage } from '@/lib/dialogs';
import { formatHours } from '@/lib/format';
import { usePractitioners } from '@/lib/queries';
import { rpc } from '@/lib/supabase';

/** Ask the clinic to move to another practitioner, or to choose one. An admin reviews the request. */
export default function ChangePractitioner() {
  const params = useLocalSearchParams<{ to?: string }>();
  const { patient } = useAuth();
  const { data: practitioners } = usePractitioners();
  // null means "let the clinic choose".
  const [to, setTo] = useState<string | null>(params.to ?? null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const current = practitioners.find((p) => p.id === patient?.primary_practitioner_id);
  const others = practitioners.filter((p) => p.id !== patient?.primary_practitioner_id);

  async function send() {
    setBusy(true);
    try {
      await rpc('request_practitioner_change', { p_to: to, p_reason: reason.trim() });
      showMessage(
        'Request sent',
        'The clinic will review it and let you know. Until then, you stay with your current practitioner.',
      );
      router.back();
    } catch (e) {
      showError('Could not send the request', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PressableScale onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
        <Icon ios="chevron.left" material="arrow_back" />
      </PressableScale>
      <View style={{ gap: 4 }}>
        <Text variant="title">Change practitioner</Text>
        <Text variant="muted">
          {current ? `You're currently seeing ${current.display_name}. ` : ''}Tell us who you'd like to see instead, or
          let the clinic choose. Once approved, your upcoming sessions with your current practitioner are cancelled so
          you can book with the new one.
        </Text>
      </View>

      <SectionHeader title="Who would you like to see?" />
      <Option selected={to === null} onPress={() => setTo(null)}>
        <View style={styles.clinicIcon}>
          <Icon ios="sparkles" material="auto_awesome" color={colors.primary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading">Let the clinic choose</Text>
          <Text variant="small">We'll match you with the right person.</Text>
        </View>
      </Option>
      {others.map((p) => (
        <Option key={p.id} selected={to === p.id} onPress={() => setTo(p.id)}>
          <Avatar name={p.display_name} uri={p.photo_url} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{p.display_name}</Text>
            <Text variant="small">{p.title}</Text>
            {formatHours(p.weekly_hours).map((line) => (
              <Text key={line} variant="small" style={{ color: colors.primary }}>
                {line}
              </Text>
            ))}
          </View>
        </Option>
      ))}

      <Field
        label="Why would you like to change?"
        placeholder="This helps the clinic find the right fit"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={2000}
      />
      <Button title="Send request" onPress={send} disabled={!reason.trim()} loading={busy} />
    </Screen>
  );
}

function Option({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Card onPress={onPress} style={[styles.option, selected && styles.selected]}>
      {children}
      <Icon
        ios={selected ? 'checkmark.circle.fill' : 'circle'}
        material={selected ? 'check_circle' : 'radio_button_unchecked'}
        color={selected ? colors.primary : colors.textFaint}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selected: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  clinicIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
});
