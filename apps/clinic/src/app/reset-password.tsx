import { colors, spacing } from '@chester/shared';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

/**
 * Where password-reset emails land. On the web Supabase reads the link itself; in the phone
 * app the link opens newchester://reset-password#access_token=…, which is read here.
 */
export default function ResetPassword() {
  const url = Linking.useLinkingURL();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !url) return;
    const params = new URLSearchParams(url.split('#')[1] ?? '');
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) void supabase.auth.setSession({ access_token, refresh_token });
  }, [url]);

  async function save() {
    if (password.length < 8) return setMessage('Use at least 8 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage('This reset link has expired. Ask for a new one from the sign-in screen.');
    router.replace('/');
  }

  return (
    <Screen>
      <Text variant="title">Choose a new password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        placeholderTextColor={colors.textFaint}
        secureTextEntry
        autoComplete="new-password"
        style={styles.input}
      />
      {message ? <Text style={{ color: colors.warning }}>{message}</Text> : null}
      <Button title="Save password" onPress={save} loading={busy} disabled={!password} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
});
