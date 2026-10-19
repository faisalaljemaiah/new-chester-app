import { colors, spacing } from '@chester/shared';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { CountDot } from '@/components/staff';
import { Avatar, Button, Card, Icon, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { usePendingAvailabilityRequests, useTransfers } from '@/lib/staff-queries';

const links: { href: Href; key: MessageKey; ios: string; material: string; adminOnly?: boolean }[] = [
  { href: '/staff/transfers', key: 'navTransfers', ios: 'arrow.left.arrow.right', material: 'swap_horiz' },
  { href: '/staff/availability', key: 'navAvailability', ios: 'clock', material: 'schedule' },
  { href: '/staff/templates', key: 'navTemplates', ios: 'envelope', material: 'mail' },
  { href: '/staff/team', key: 'navTeam', ios: 'person.badge.plus', material: 'person_add', adminOnly: true },
];

/** Everything that doesn't fit in the tab bar, plus language and sign-out. */
export default function More() {
  const { user, isAdmin, practitioner, signOut } = useAuth();
  const { t, locale, setLocale, dir } = useI18n();
  const { data: incoming } = useTransfers(user?.id, 'to_practitioner_id');
  const { data: requests } = usePendingAvailabilityRequests(isAdmin);
  const counts: Partial<Record<MessageKey, number>> = {
    navTransfers: incoming.filter((x) => x.status === 'pending').length,
    navAvailability: requests.length,
  };
  const name = (locale === 'ar' && practitioner?.display_name_ar) || practitioner?.display_name || user?.email || '';

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={name} uri={practitioner?.photo_url} size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{name}</Text>
          <Text variant="small">{isAdmin ? 'Admin' : practitioner?.title}</Text>
        </View>
      </Card>

      {links
        .filter((l) => !l.adminOnly || isAdmin)
        .map((l) => (
          <Card
            key={l.key}
            onPress={() => router.push(l.href)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon ios={l.ios} material={l.material} color={colors.primary} />
            <Text variant="heading" style={{ flex: 1 }}>
              {t(l.key)}
            </Text>
            <CountDot count={counts[l.key] ?? 0} />
            <Icon
              ios={dir === 'rtl' ? 'chevron.left' : 'chevron.right'}
              material={dir === 'rtl' ? 'chevron_left' : 'chevron_right'}
              color={colors.textMuted}
              size={18}
            />
          </Card>
        ))}

      <Button
        title={`${t('switchLanguage')}: ${t('language')}`}
        variant="secondary"
        onPress={() => setLocale(locale === 'en' ? 'ar' : 'en')}
      />
      <Button title={t('signOut')} variant="danger" onPress={() => signOut().then(() => router.replace('/welcome'))} />
    </Screen>
  );
}
