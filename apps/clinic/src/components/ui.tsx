import { colors, radius, spacing } from '@chester/shared';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type ColorValue,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView, PressableScale } from '@/components/motion';
import { useI18n } from '@/lib/i18n';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** SF Symbol on iOS, Material Symbol on Android and web. */
export function Icon({
  ios,
  material,
  size = 22,
  color = colors.text,
}: {
  ios: string;
  material: string;
  size?: number;
  color?: ColorValue;
}) {
  return <SymbolView name={{ ios, android: material, web: material } as SymbolName} size={size} tintColor={color} />;
}

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
          <FadeInView rise={false} style={{ gap: spacing.lg }}>
            {children}
          </FadeInView>
        </ScrollView>
      ) : (
        <FadeInView rise={false} style={[styles.screenContent, { flex: 1 }]}>
          {children}
        </FadeInView>
      )}
    </SafeAreaView>
  );
}

// Sizes, weights and tracking follow Apple's type scale (San Francisco is the system font on Apple devices).
const textVariants = {
  hero: { fontSize: 40, fontWeight: '700', lineHeight: 46, color: colors.text, letterSpacing: -0.8 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  small: { fontSize: 12, color: colors.textMuted },
} as const;

export function Text({ variant = 'body', style, ...props }: TextProps & { variant?: keyof typeof textVariants }) {
  // Tighter tracking breaks the joins between Arabic letters, so it is dropped in Arabic.
  const { dir } = useI18n();
  return <RNText {...props} style={[textVariants[variant], dir === 'rtl' && { letterSpacing: 0 }, style]} />;
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={[styles.card, style]}>
      {children}
    </PressableScale>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const bg = { primary: colors.primary, secondary: colors.surfaceRaised, danger: colors.dangerSoft }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, danger: colors.danger }[variant];
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <RNText style={[styles.buttonText, { color: fg }]}>{title}</RNText>
          {icon}
        </>
      )}
    </PressableScale>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="heading">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="small" style={{ color: colors.primary }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <RNText style={{ color: colors.primary, fontWeight: '700', fontSize: size * 0.36 }}>{initials}</RNText>
      )}
    </View>
  );
}

/** Time slot chip, styled like "Available Today" in the reference. */
export function Chip({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.93}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <RNText style={[styles.chipLabel, selected && { color: colors.onPrimary }]}>{label}</RNText>
      {sublabel ? (
        <RNText style={[styles.chipSub, selected && { color: colors.onPrimary }]}>{sublabel}</RNText>
      ) : null}
    </PressableScale>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <Text variant="muted">{text}</Text>
    </Card>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.xl, paddingBottom: 120, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.75 },
  button: {
    height: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  avatar: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chip: {
    minWidth: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  chipSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
