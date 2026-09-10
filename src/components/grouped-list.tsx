import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function GroupedList({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: theme.card }]}>{children}</View>
  );
}

export function GroupedRow({
  children,
  last = false,
}: {
  children: ReactNode;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.row}>{children}</View>
      {!last && (
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
      )}
    </>
  );
}

export function Chevron() {
  const theme = useTheme();
  return (
    <SymbolView
      name="chevron.right"
      size={13}
      weight="semibold"
      tintColor={theme.chevron}
      style={{ marginLeft: 4 }}
    />
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
});
