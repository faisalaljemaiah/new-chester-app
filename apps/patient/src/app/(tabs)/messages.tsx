import { colors, spacing, type Practitioner } from '@chester/shared';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Avatar, Card, Empty, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useMyConversations, usePractitioners } from '@/lib/queries';

export default function Messages() {
  const { user } = useAuth();
  const { data: conversations, loading } = useMyConversations(user?.uid);
  const { data: practitioners } = usePractitioners();
  const byId = new Map(practitioners.map((p) => [p.id, p as Practitioner]));

  const sorted = [...conversations].sort(
    (a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0),
  );

  return (
    <Screen>
      <Text variant="title">Messages</Text>
      <Text variant="muted">Messages from your care team, including check-in forms they send you.</Text>
      {!loading && sorted.length === 0 && <Empty text="Your conversation opens after you book a session." />}
      {sorted.map((c) => {
        const p = byId.get(c.practitionerId);
        const name = p?.displayName ?? 'Your practitioner';
        return (
          <Card
            key={c.id}
            onPress={() => router.push(`/chat/${c.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={name} uri={p?.photoUrl} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{name}</Text>
              <Text variant="small" numberOfLines={1}>
                {c.lastMessage ?? 'Say hello'}
              </Text>
            </View>
            {c.lastMessageAt ? (
              <Text variant="small" style={{ color: colors.textFaint }}>
                {formatDate(c.lastMessageAt)}
              </Text>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
