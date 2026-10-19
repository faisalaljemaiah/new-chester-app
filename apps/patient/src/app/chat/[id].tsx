import { colors, radius, spacing, type ChatMessage, type Conversation, type Practitioner } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { formatTime } from '@/lib/format';
import { useDocument, useQuery } from '@/lib/hooks';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: convo } = useDocument<Conversation>(`conversations/${id}`);
  const { data: practitioner } = useDocument<Practitioner>(convo ? `practitioners/${convo.practitionerId}` : null);
  const q = useMemo(() => query(collection(db, 'conversations', id, 'messages'), orderBy('createdAt', 'desc')), [id]);
  const { data: messages } = useQuery<ChatMessage>(q);
  const [text, setText] = useState('');
  const sending = useRef(false);

  async function send() {
    const body = text.trim();
    if (!body || !user || sending.current) return;
    sending.current = true;
    setText('');
    try {
      await addDoc(collection(db, 'conversations', id, 'messages'), {
        senderId: user.uid,
        text: body,
        createdAt: serverTimestamp(),
      });
    } finally {
      sending.current = false;
    }
  }

  const name = practitioner?.displayName ?? 'Your practitioner';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon ios="chevron.left" material="arrow_back" />
        </Pressable>
        <Avatar name={name} uri={practitioner?.photoUrl} size={36} />
        <Text variant="heading">{name}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.uid;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={{ color: mine ? colors.onPrimary : colors.text }}>{item.text}</Text>
                {item.assessmentAssignmentId ? (
                  <Pressable
                    style={styles.formButton}
                    onPress={() => router.push(`/assessment/${item.assessmentAssignmentId}`)}>
                    <Icon ios="list.clipboard" material="assignment" color={colors.onPrimary} size={16} />
                    <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Open check-in</Text>
                  </Pressable>
                ) : null}
                {item.createdAt ? (
                  <Text variant="small" style={{ color: mine ? colors.primarySoft : colors.textFaint, alignSelf: 'flex-end' }}>
                    {formatTime(item.createdAt)}
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
