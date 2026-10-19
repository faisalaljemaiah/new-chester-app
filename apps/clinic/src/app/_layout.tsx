import { colors } from '@chester/shared';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <I18nProvider>
    <AuthProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="staff" />
          <Stack.Screen name="practitioner/[id]" />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="assessment/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
    </I18nProvider>
  );
}
