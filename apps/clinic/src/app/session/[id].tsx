import { colors, radius, spacing, type Appointment, type Conversation } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Group, GroupedScreen, ios, Row, RowIcon } from '@/components/grouped';
import { Avatar, Button, Empty, Loading, Screen, Text } from '@/components/ui';
import { confirm, showError } from '@/lib/dialogs';
import { formatDate, formatTime } from '@/lib/format';
import { useLive } from '@/lib/hooks';
import { useRescheduleRequests } from '@/lib/queries';
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
  const { data: reschedules } = useRescheduleRequests(a?.id);
  const pendingMove = reschedules.find((r) => r.status === 'pending');
  const lastMove = reschedules[0];
  const now = useNow();

  if (loading) return <Loading />;
  if (!a)
    return (
      <Screen>
        <Empty text="Session not found." />
      </Screen>
    );

  const start = Date.parse(a.start_at);
  const end = Date.parse(a.end_at);
  const live = a.status === 'scheduled' && now >= start - 10 * 60_000 && now <= end;
  const countdown = start - now;

  const cancel = () =>
    confirm('Cancel this session?', 'Your practitioner will be notified.', 'Cancel session', 'Keep it', () =>
      rpc('cancel_appointment', { p_appointment: id }).catch((e) => showError('Could not cancel', e)),
    );

  const withdrawMove = (requestId: string) =>
    confirm('Withdraw your request?', 'Your session stays at its current time.', 'Withdraw', 'Keep it', () =>
      rpc('withdraw_request', { p_request: requestId }).catch((e) => showError('Could not withdraw', e)),
    );

  const minutes = Math.round((end - start) / 60_000);
  const modeLabel = a.mode === 'video' ? 'Video' : a.mode === 'audio' ? 'Voice' : 'Chat';
  const statusLabel = live ? 'Ready to join' : a.status === 'scheduled' ? 'Scheduled' : capitalize(a.status);

  return (
    <GroupedScreen back="Sessions">
      <View style={styles.hero}>
        <Avatar name={a.practitioner_name} size={96} />
        <Text style={styles.heroName}>{a.practitioner_name}</Text>
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: live ? colors.success : ios.secondary }]} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <Group header="Details">
        <Row
          left={<RowIcon ios="calendar" material="event" color="#FF3B30" />}
          title="Date"
          value={formatDate(a.start_at)}
        />
        <Row
          left={<RowIcon ios="clock.fill" material="schedule" color="#FF9500" />}
          title="Time"
          value={formatTime(a.start_at)}
        />
        <Row left={<RowIcon ios="timer" material="timer" color="#34C759" />} title="Length" value={`${minutes} min`} />
        <Row left={<RowIcon ios="video.fill" material="videocam" color="#007AFF" />} title="Type" value={modeLabel} />
        {countdown > 0 && a.status === 'scheduled' ? (
          <Row
            left={<RowIcon ios="hourglass" material="hourglass_top" color={colors.primary} />}
            title="Starts in"
            value={formatCountdown(countdown)}
          />
        ) : null}
      </Group>

      {a.status === 'scheduled' && (
        <>
          <View style={{ gap: spacing.sm }}>
            <Button
              title={live ? 'Join Session' : 'Join opens 10 minutes before'}
              disabled={!live || !a.meeting_url}
              onPress={() => a.meeting_url && WebBrowser.openBrowserAsync(a.meeting_url)}
            />
            {live && !a.meeting_url ? (
              <Text style={styles.note}>Your practitioner will share the session link here shortly.</Text>
            ) : null}
          </View>

          {pendingMove ? (
            <Group
              header="Postponement requested"
              footer="Your session stays at its current time until your practitioner agrees.">
              <Row
                left={<RowIcon ios="calendar.badge.clock" material="update" color="#FF9500" />}
                title="Requested time"
                subtitle={`${formatDate(pendingMove.new_start_at)} · ${formatTime(pendingMove.new_start_at)}`}
                value="Waiting"
              />
              <Row title="Withdraw Request" destructive onPress={() => withdrawMove(pendingMove.id)} chevron={false} />
            </Group>
          ) : null}

          <Group
            footer={
              lastMove?.status === 'declined' && !pendingMove
                ? `Your practitioner couldn't move this session to ${formatDate(lastMove.new_start_at)}. You can ask for another time.`
                : undefined
            }>
            {conversation ? (
              <Row
                left={<RowIcon ios="bubble.left.fill" material="chat_bubble" color="#34C759" />}
                title="Message Practitioner"
                onPress={() => router.push(`/chat/${conversation.id}`)}
              />
            ) : null}
            {countdown > 0 && !pendingMove ? (
              <Row
                left={<RowIcon ios="calendar.badge.clock" material="update" color="#FF9500" />}
                title="Request to Postpone"
                onPress={() => router.push(`/postpone/${a.id}`)}
              />
            ) : null}
          </Group>

          {countdown > 0 ? (
            <Group footer="Your practitioner will be notified.">
              <Row title="Cancel Session" destructive centered onPress={cancel} chevron={false} />
            </Group>
          ) : null}
        </>
      )}
    </GroupedScreen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  heroName: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4 },
  note: { fontSize: 13, color: ios.secondary, textAlign: 'center' },
});
