import { colors, radius, spacing } from '@chester/shared';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'sign-up') {
        // The database creates the patient file from these details when the account is created.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), phone: phone.trim() || undefined } },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is on: the account works once they click the link.
          setMode('sign-in');
          setMessage('Check your email and tap the link to confirm your account, then sign in.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      // The start screen picks patient or staff screens from the account's role.
      router.replace('/');
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) return setMessage('Enter your email first.');
    // The link opens the app's reset screen (add this URL under Supabase Auth > URL Configuration).
    await supabase.auth
      .resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/reset-password') })
      .catch(() => {});
    setMessage('If that email has an account, a reset link is on its way.');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Text variant="title">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
        <Text variant="muted">
          {mode === 'sign-in' ? 'Sign in to see your sessions and messages.' : 'It takes less than a minute.'}
        </Text>

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {mode === 'sign-up' && (
            <>
              <Field placeholder="Full name" value={name} onChangeText={setName} autoComplete="name" />
              <Field
                placeholder="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </>
          )}
          <Field
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          />
        </View>

        {message ? <Text style={{ color: colors.warning }}>{message}</Text> : null}

        <Button
          title={mode === 'sign-in' ? 'Sign In' : 'Create Account'}
          onPress={submit}
          loading={busy}
          disabled={!email || !password || (mode === 'sign-up' && !name)}
        />

        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} style={styles.link}>
          <Text variant="muted">
            {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={{ color: colors.primary }}>{mode === 'sign-in' ? 'Sign up' : 'Sign in'}</Text>
          </Text>
        </Pressable>
        {mode === 'sign-in' && (
          <Pressable onPress={resetPassword} style={styles.link}>
            <Text variant="small">Forgot password?</Text>
          </Pressable>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.textFaint} style={styles.input} {...props} />;
}

function friendlyError(e: unknown) {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'invalid_credentials') return 'Email or password is incorrect.';
  if (code === 'email_not_confirmed') return 'Please confirm your email first. Check your inbox for the link.';
  if (code === 'user_already_exists' || code === 'email_exists') return 'That email already has an account. Try signing in.';
  if (code === 'weak_password') return 'Use a password with at least 8 characters.';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'That email address does not look right.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many attempts. Please wait a few minutes.';
  return 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  input: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 15,
  },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
});
