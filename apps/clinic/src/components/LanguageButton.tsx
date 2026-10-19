import { colors, radius, spacing } from '@chester/shared';
import { Pressable, StyleSheet } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

/** Switches the app between English and Arabic. `light` is for dark backgrounds such as the welcome photo. */
export function LanguageButton({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const { locale, setLocale } = useI18n();
  const color = tone === 'light' ? '#FFFFFF' : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
      onPress={() => setLocale(locale === 'en' ? 'ar' : 'en')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color, backgroundColor: tone === 'light' ? 'rgba(255,255,255,0.12)' : colors.primarySoft },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon ios="globe" material="language" color={color} size={18} />
      <Text style={[styles.label, { color }]}>{locale === 'en' ? 'عربي' : 'EN'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
