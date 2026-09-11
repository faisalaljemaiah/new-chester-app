import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { PrimaryButton, TextButton } from '@/components/buttons';
import { TextField } from '@/components/text-field';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await signUp(email.trim(), password);
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    setMessage('Check your email to confirm your account, then sign in.');
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Logo size={56} />
            <Text style={[styles.title, { color: theme.text }]}>Create your account</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Join New Chester Virtual Clinic
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            {error && (
              <Text style={[styles.error, { color: theme.danger }]} role="alert">
                {error}
              </Text>
            )}
            {message && (
              <Text style={[styles.error, { color: theme.primary }]} role="status">
                {message}
              </Text>
            )}
            <PrimaryButton
              title={submitting ? 'Creating account…' : 'Create account'}
              onPress={handleSubmit}
              disabled={submitting || !email || !password}
              style={{ marginTop: 4, opacity: submitting || !email || !password ? 0.5 : 1 }}
            />
          </View>

          <Link href="/(auth)/login" asChild>
            <TextButton title="Already have an account? Sign in" />
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 28 },
  header: { alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: Fonts.sans, marginTop: 8 },
  subtitle: { fontSize: 15, fontFamily: Fonts.sans, textAlign: 'center' },
  form: { gap: 14 },
  error: { fontSize: 13, fontFamily: Fonts.sans, textAlign: 'center' },
});
