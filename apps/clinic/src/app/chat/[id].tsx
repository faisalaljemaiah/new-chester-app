import { colors, radius, spacing, type ChatMessage, type Conversation, type Practitioner } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatTime } from '@/lib/format';
import { useLive, useRows } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: convo } = useLive<Conversation>(
    `conversation:${id}`,
    () => supabase.from('conversations').select('*').eq('id', id).maybeSingle(),
    [],
  );
  // Read the id outside the query: the React Compiler would otherwise read it while `convo` is still null.
  const practitionerId = convo?.practitioner_id;
  const { data: practitioner } = useLive<Practitioner>(
    practitionerId ? `practitioner:${practitionerId}` : null,
    () => supabase.from('practitioners').select('*').eq('id', practitionerId!).maybeSingle(),
    [],
  );
  // Newest first, because the list is inverted.
  const { data: messages } = useRows<ChatMessage>(
    `messages:${id}`,
    () => supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }),
    ['messages'],
  );

  // Mark the practitioner's messages as read while the chat is open.
  const unread = messages.some((m) => !m.read_at && m.sender_id !== user?.id);
  useEffect(() => {
    if (!unread || !user) return;
    void supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);
  }, [unread, id, user]);
  const [text, setText] = useState('');
  const sending = useRef(false);

  async function send() {
    const body = text.trim();
    if (!body || !user || sending.current) return;
    sending.current = true;
    setText('');
    try {
      await must(supabase.from('messages').insert({ conversation_id: id, text: body }));
    } catch {
      setText(body);
    } finally {
      sending.current = false;
    }
  }

  const name = practitioner?.display_name ?? 'Your practitioner';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon ios="chevron.left" material="arrow_back" />
        </Pressable>
        <Avatar name={name} uri={practitioner?.photo_url} size={36} />
        <Text variant="heading">{name}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={{ color: mine ? colors.onPrimary : colors.text }}>{item.text}</Text>
                {item.assessment_assignment_id ? (
                  <Pressable
                    style={styles.formButton}
                    onPress={() => router.push(`/assessment/${item.assessment_assignment_id}`)}>
                    <Icon ios="list.clipboard" material="assignment" color={colors.onPrimary} size={16} />
                    <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Open check-in</Text>
                  </Pressable>
                ) : null}
                {item.created_at ? (
                  <Text variant="small" style={{ color: mine ? colors.primarySoft : colors.textFaint, alignSelf: 'flex-end' }}>
                    {formatTime(item.created_at)}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            multiline
          />
          <Pressable onPress={send} style={styles.send} accessibilityLabel="Send">
            <Icon ios="paperplane.fill" material="send" color={colors.onPrimary} size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.lg, gap: 6 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderBottomLeftRadius: 4 },
  formButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryPressed,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
