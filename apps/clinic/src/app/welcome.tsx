import { colors, radius, spacing } from '@chester/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components/ui';

/** Matches the dark hospital background of the photo, so the edges blend on tall screens. */
const backdrop = '#141B26';

/** First screen: full-screen doctor photo with the title on top and a white Get Started button. */
export default function Welcome() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Photo supplied by the clinic; confirm the licence before launch. */}
      <Image
        source={require('../../assets/images/welcome-hero.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="top"
      />
      <LinearGradient
        colors={['rgba(20,27,38,0.55)', 'rgba(20,27,38,0)']}
        style={[styles.shade, { top: 0 }]}
      />
      <LinearGradient
        colors={['rgba(20,27,38,0)', 'rgba(20,27,38,0.9)']}
        style={[styles.shade, { bottom: 0 }]}
      />

      <SafeAreaView style={styles.content}>
        <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
          <Text style={styles.title}>
            Your{'\n'}Mind,{'\n'}
            <Text style={[styles.title, { color: colors.primary }]}>Cared For</Text>
          </Text>
          <Text style={styles.subtitle}>
            Expert care, anytime, anywhere. Your wellbeing is our priority.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/sign-in')}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Icon ios="arrow.right" material="arrow_forward" color={colors.primary} size={20} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: backdrop },
  shade: { position: 'absolute', left: 0, right: 0, height: '35%' },
  content: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  title: { fontSize: 46, lineHeight: 52, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.82)', maxWidth: 190 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 18,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  buttonText: { fontSize: 18, fontWeight: '600', color: colors.primary },
});
