import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

// Sign-in isn't required for now (demo/preview mode) -- the login/signup
// screens have been moved out of src/app (see src/features/auth) so
// they're not reachable at all. This just waits out the initial session
// check so the profile tab doesn't flash between guest and signed-in state.
function AuthGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="result" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="booking" options={{ presentation: 'modal' }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
