import { colors } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Group, GroupBox, GroupedScreen, Row, RowIcon } from '@/components/grouped';
import { Avatar, Button } from '@/components/ui';
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
    <GroupedScreen
      title="Change Practitioner"
      subtitle={`${current ? `You're seeing ${current.display_name}. ` : ''}Choose who you'd like to see instead, or let the clinic choose.`}>
      <Group header="Who would you like to see?">
        <Row
          left={<RowIcon ios="sparkles" material="auto_awesome" color={colors.primary} />}
          title="Let the clinic choose"
          subtitle="We'll match you with the right person."
          checked={to === null}
          chevron={false}
          onPress={() => setTo(null)}
        />
        {others.map((p) => (
          <Row
            key={p.id}
            left={<Avatar name={p.display_name} uri={p.photo_url} size={40} />}
            title={p.display_name}
            subtitle={[p.title, ...formatHours(p.weekly_hours)].join('\n')}
            checked={to === p.id}
            chevron={false}
            onPress={() => setTo(p.id)}
          />
        ))}
      </Group>

      <GroupBox
        header="Reason"
        footer="Once the clinic approves, your upcoming sessions with your current practitioner are cancelled so you can book with the new one.">
        <TextInput
          placeholder="Why would you like to change?"
          placeholderTextColor="#C4C4C7"
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={2000}
          style={styles.input}
        />
      </GroupBox>

      <Button title="Send Request" onPress={send} disabled={!reason.trim()} loading={busy} />
    </GroupedScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 88, fontSize: 17, color: colors.text, textAlignVertical: 'top', padding: 4 },
});
