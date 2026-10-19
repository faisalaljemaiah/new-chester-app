import { colors, radius, severityColors, spacing } from '@chester/shared';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components/ui';
import { useI18n, type MessageKey } from '@/lib/i18n';

// Building blocks for the staff screens, on top of components/ui.tsx. Layout follows the
// language: rows flip in Arabic because the staff layout sets `direction: 'rtl'`.

const tones = {
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.surfaceRaised, fg: colors.textMuted },
} as const;
export type Tone = keyof typeof tones;

export function Badge({ label, tone = 'primary' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text variant="small" style={{ color: t.fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const statusTone: Record<string, Tone> = {
  scheduled: 'primary',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'warning',
  pending: 'warning',
  accepted: 'success',
  approved: 'success',
  declined: 'neutral',
  rejected: 'neutral',
  active: 'success',
  on_hold: 'warning',
  discharged: 'neutral',
  sent: 'warning',
};

/** Status pill whose label comes from the dictionary (the status value is also a message key). */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <Badge label={t(status as MessageKey) ?? status} tone={statusTone[status] ?? 'primary'} />;
}

/** Severity 0–4, colored like the score charts. */
export function SeverityBadge({ level, label }: { level: number; label: string }) {
  const { severityLabel } = useI18n();
  const color = severityColors[Math.max(0, Math.min(4, level))];
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceRaised, borderColor: color, borderWidth: 1 }]}>
      <Text variant="small" style={{ color, fontWeight: '600' }}>
        {severityLabel(level, label)}
      </Text>
    </View>
  );
}

/** Small counter for unread or pending items. */
export function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.dot}>
      <Text variant="small" style={{ color: colors.onPrimary, fontWeight: '700' }}>
        {count}
      </Text>
    </View>
  );
}

/** Segmented control, used where the web dashboard had tabs. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, active && styles.segmentActive]}>
            <Text style={{ color: active ? colors.onPrimary : colors.textMuted, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Labelled text input. */
export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { dir } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="small">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
          { textAlign: dir === 'rtl' ? 'right' : 'left' },
          style,
        ]}
      />
    </View>
  );
}

/** A row of tappable options, like a select on the web. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="small">{label}</Text> : null}
      <View style={styles.choices}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.choice, active && styles.choiceActive]}>
              <Text style={{ color: active ? colors.onPrimary : colors.text }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Bottom sheet for forms (transfer a patient, new template, ...). */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { dir } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { direction: dir }]}>
        <View style={styles.sheetHeader}>
          <Text variant="heading" style={{ flex: 1 }}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Icon ios="xmark" material="close" color={colors.textMuted} size={20} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Title row for pushed staff screens, with a back arrow that points the right way in Arabic. */
export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { dir } = useI18n();
  return (
    <View style={styles.backHeader}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/staff'))} hitSlop={12}>
        <Icon
          ios={dir === 'rtl' ? 'chevron.right' : 'chevron.left'}
          material={dir === 'rtl' ? 'arrow_forward' : 'arrow_back'}
        />
      </Pressable>
      <Text variant="title" style={{ flex: 1, fontSize: 20 }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** Horizontal row with spacing, the most common layout on the staff screens. */
export function Row({ children, gap = spacing.md, style }: { children: ReactNode; gap?: number; style?: object }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  dot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, gap: 4 },
  segmentItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.primary },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  choiceActive: { backgroundColor: colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(31,26,51,0.35)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
