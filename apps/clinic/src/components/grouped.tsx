// iOS Settings-style "inset grouped" lists: white rounded sections on a light grey page,
// small grey headers and footers, hairline separators that start after the icon.

import { colors, spacing } from '@chester/shared';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ColorValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView, PressableScale } from '@/components/motion';
import { Icon, Text } from '@/components/ui';
import { router } from 'expo-router';

export const ios = {
  background: '#F2F2F7',
  separator: 'rgba(60,60,67,0.18)',
  secondary: '#8A8A8E',
  red: '#FF3B30',
};

/** Grey page with a back chevron and a large title, like a pushed iOS screen. */
export function GroupedScreen({
  title,
  subtitle,
  back = 'Back',
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Icon ios="chevron.left" material="chevron_left" color={colors.primary} size={26} />
        <Text style={styles.backText}>{back}</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeInView rise={false} style={{ gap: spacing.xl }}>
          {title ? (
            <View style={{ gap: 4, paddingHorizontal: 4 }}>
              <Text style={styles.largeTitle}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One white rounded section. Children are rows; separators are drawn between them. */
export function Group({ header, footer, children }: { header?: string; footer?: ReactNode; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View>
      {header ? <Text style={styles.header}>{header.toUpperCase()}</Text> : null}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

/** A coloured rounded square with a white glyph, as in iOS Settings. */
export function RowIcon({
  ios: sf,
  material,
  color = colors.primary,
}: {
  ios: string;
  material: string;
  color?: ColorValue;
}) {
  return (
    <View style={[styles.rowIcon, { backgroundColor: color }]}>
      <Icon ios={sf} material={material} color="#FFFFFF" size={17} />
    </View>
  );
}

export function Row({
  title,
  subtitle,
  value,
  left,
  onPress,
  chevron = !!onPress,
  checked,
  destructive,
  tint,
  centered,
}: {
  title: string;
  subtitle?: ReactNode;
  value?: string;
  left?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  checked?: boolean;
  destructive?: boolean;
  /** Draws the title in the accent colour, for action rows. */
  tint?: boolean;
  centered?: boolean;
}) {
  const color = destructive ? ios.red : tint ? colors.primary : colors.text;
  const body = (
    <>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, { color }, centered && { textAlign: 'center' }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {checked ? <Icon ios="checkmark" material="check" color={colors.primary} size={20} /> : null}
      {chevron && !checked ? <Icon ios="chevron.right" material="chevron_right" color="#C4C4C7" size={18} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={styles.row}>
      {body}
    </PressableScale>
  );
}

/** A section that holds free content (chips, a text box) instead of rows. */
export function GroupBox({ header, footer, children }: { header?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <View>
      {header ? <Text style={styles.header}>{header.toUpperCase()}</Text> : null}
      <View style={[styles.group, { padding: spacing.md }]}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ios.background },
  back: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  backText: { fontSize: 17, color: colors.primary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: spacing.xs },
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', color: colors.text, letterSpacing: 0.4 },
  subtitle: { fontSize: 15, lineHeight: 20, color: ios.secondary },
  header: { fontSize: 13, color: ios.secondary, paddingHorizontal: spacing.lg, marginBottom: 7, letterSpacing: -0.08 },
  footer: { fontSize: 13, lineHeight: 18, color: ios.secondary, paddingHorizontal: spacing.lg, marginTop: 7 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: spacing.lg },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  rowIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17, letterSpacing: -0.4 },
  rowSubtitle: { fontSize: 13, lineHeight: 17, color: ios.secondary },
  rowValue: { fontSize: 17, color: ios.secondary, letterSpacing: -0.4 },
});
