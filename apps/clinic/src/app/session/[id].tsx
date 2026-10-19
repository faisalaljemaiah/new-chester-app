import { colors, radius, spacing, type Appointment, type Conversation } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Empty, Icon, Loading, Screen, Text } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import { useLive } from '@/lib/hooks';
import { rpc, supabase } from '@/lib/supabase';

/** Session details, modelled on the "Live Consultation" screen of the reference. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: a, loading } = useLive<Appointment>(
    `appointment:${id}`,
    () => supabase.from('appointments').select('*').eq('id', id).maybeSingle(),
    ['appointments'],
  );
  // Read the id outside the query: the React Compiler would otherwise read a.practitioner_id while `a` is still null.
  const practitionerId = a?.practitioner_id;
  const { data: conversation } = useLive<Conversation>(
    practitionerId ? `conversation:${practitionerId}` : null,
    () => supabase.from('conversations').select('*').eq('practitioner_id', practitionerId!).maybeSingle(),
    [],
  );
  const now = useNow();

  if (loading) return <Loading />;
  if (!a) return <Screen><Empty text="Session not found." /></Screen>;

  const start = Date.parse(a.start_at);
  const end = Date.parse(a.end_at);
  const live = a.status === 'scheduled' && now >= start - 10 * 60_000 && now <= end;
  const countdown = start - now;

  function cancel() {
    Alert.alert('Cancel this session?', 'Your practitioner will be notified.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel session',
        style: 'destructive',
        onPress: () =>
          rpc('cancel_appointment', { p_appointment: id }).catch((e: Error) => Alert.alert('Could not cancel', e.message)),
      },
    ]);
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Icon ios="chevron.left" material="arrow_back" />
      </Pressable>

      <Card style={styles.hero}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="small">{live ? 'Live Consultation' : 'Your Session'}</Text>
          <Text variant="title" style={{ fontSize: 22 }}>{a.practitioner_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: live ? colors.success : colors.textFaint }]} />
            <Text variant="small">{live ? 'Ready to join' : a.status === 'scheduled' ? 'Scheduled' : a.status}</Text>
          </View>
        </View>
        <Avatar name={a.practitioner_name} size={88} />
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View style={styles.iconBox}>
          <Icon ios="video.fill" material="videocam" color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="small">{formatDate(a.start_at)}</Text>
          <Text variant="title">{formatTime(a.start_at)}</Text>
          <Text variant="small">
            {Math.round((end - start) / 60_000)} minutes · {a.mode}
          </Text>
        </View>
        {countdown > 0 && a.status === 'scheduled' ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="small">Starts in</Text>
            <Text variant="heading" style={{ color: colors.primary }}>{formatCountdown(countdown)}</Text>
          </View>
        ) : null}
      </Card>

      {a.status === 'scheduled' && (
        <>
          <Button
            title={live ? 'Join Session' : 'Join opens 10 minutes before'}
            disabled={!live || !a.meeting_url}
            onPress={() => a.meeting_url && WebBrowser.openBrowserAsync(a.meeting_url)}
          />
          {live && !a.meeting_url ? (
            <Text variant="small">Your practitioner will share the session link here shortly.</Text>
          ) : null}
          {conversation ? (
            <Button
              title="Message your practitioner"
              variant="secondary"
              onPress={() => router.push(`/chat/${conversation.id}`)}
            />
          ) : null}
          {countdown > 0 && <Button title="Cancel session" variant="danger" onPress={cancel} />}
        </>
      )}
    </Screen>
  );
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatCountdown(ms: number) {
  const mins = Math.floor(ms / 60_000);
  if (mins >= 60 * 24) return `${Math.floor(mins / (60 * 24))}d`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
