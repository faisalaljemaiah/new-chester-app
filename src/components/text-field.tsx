import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textTertiary}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text, fontFamily: Fonts.sans },
          style as object,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.sans },
  input: {
    height: 48,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
  },
});
