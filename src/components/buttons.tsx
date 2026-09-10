import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = PressableProps & {
  title: string;
};

export function PrimaryButton({ title, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        style as object,
      ]}
      {...rest}>
      <Text style={[styles.label, { color: theme.onPrimary }]}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: theme.primaryPale, opacity: pressed ? 0.85 : 1 },
        style as object,
      ]}
      {...rest}>
      <Text style={[styles.label, { color: theme.primary }]}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  return (
    <Pressable style={[styles.textButton, style as object]} {...rest}>
      <Text style={[styles.textButtonLabel, { color: theme.textTertiary }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  textButton: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: Fonts.sans,
  },
});
