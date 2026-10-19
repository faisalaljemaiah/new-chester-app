import { colors, radius, spacing } from '@chester/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageButton } from '@/components/LanguageButton';
import { Icon, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** Matches the dark hospital background of the photo, so the edges blend on tall screens. */
const backdrop = '#141B26';

/** First screen: full-screen doctor photo with the title on top and a white Get Started button. */
export default function Welcome() {
  const { t, dir } = useI18n();
  // The photo stays the same in both languages, so the text keeps to the left (away from the face)
  // and is right-aligned for Arabic.
  const rtlText = dir === 'rtl' ? ({ textAlign: 'right', writingDirection: 'rtl', letterSpacing: 0 } as const) : null;
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
        <View style={{ gap: spacing.lg, marginTop: spacing.sm }}>
          <View style={styles.topRow}>
            <Image
              source={require('../../assets/images/logo-white.png')}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="New Chester Virtual Clinics"
            />
            <LanguageButton tone="light" />
          </View>
          <Text style={[styles.title, rtlText]}>
            {t('welcomeLine1')}
            {'\n'}
            {t('welcomeLine2')}
            {'\n'}
            <Text style={[styles.title, { color: colors.primary }]}>{t('welcomeLine3')}</Text>
          </Text>
          <Text style={[styles.subtitle, rtlText]}>
            {t('welcomeSubtitle')}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/sign-in')}
          style={({ pressed }) => [
            styles.button,
            dir === 'rtl' && { flexDirection: 'row-reverse' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.buttonText}>{t('getStarted')}</Text>
          <Icon ios={dir === 'rtl' ? 'arrow.left' : 'arrow.right'} material={dir === 'rtl' ? 'arrow_back' : 'arrow_forward'} color={colors.primary} size={20} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: backdrop, direction: 'ltr' },
  shade: { position: 'absolute', left: 0, right: 0, height: '35%' },
  content: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  logo: { width: 104, height: 58 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { maxWidth: 260, fontSize: 44, lineHeight: 50, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1.2 },
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
  buttonText: { fontSize: 17, fontWeight: '600', color: colors.primary, letterSpacing: -0.2 },
});
