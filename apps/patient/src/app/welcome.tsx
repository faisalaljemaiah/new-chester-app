import { colors, radius, spacing } from '@chester/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components/ui';

/** First screen, modelled on the "Your Health, Simplified" screen of the reference. */
export default function Welcome() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.badge}>
        <Icon ios="brain.head.profile" material="psychology" color={colors.primary} size={28} />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="hero">
          Your Mind,{'\n'}
          <Text variant="hero" style={{ color: colors.primary }}>
            Cared For
          </Text>
        </Text>
        <Text variant="muted" style={{ maxWidth: 280 }}>
          Psychiatry and psychology sessions online. Private, professional, and on your schedule.
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ gap: spacing.md }}>
        <Feature ios="lock.shield" material="shield_lock" text="Secure & private sessions" />
        <Feature ios="person.2" material="groups" text="Licensed psychiatrists & psychologists" />
      </View>

      <Button
        title="Get Started"
        onPress={() => router.push('/sign-in')}
        icon={<Icon ios="arrow.right" material="arrow_forward" color={colors.onPrimary} size={18} />}
      />
    </SafeAreaView>
  );
}

function Feature({ ios, material, text }: { ios: string; material: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={styles.featureIcon}>
        <Icon ios={ios} material={material} color={colors.primary} size={18} />
      </View>
      <Text variant="muted">{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl },
  badge: {
    alignSelf: 'flex-end',
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
