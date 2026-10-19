import { colors, radius, spacing } from '@chester/shared';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { Icon, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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

  const signUp = mode === 'sign-up';
  const mismatch = signUp && confirm.length > 0 && confirm !== password;

  function switchMode(next: 'sign-in' | 'sign-up') {
    setMode(next);
    setMessage(null);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Decor />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
            {!signUp && <Text style={styles.greeting}>Welcome!</Text>}
            <Text style={styles.title}>{signUp ? 'Sign up' : 'Login'}</Text>
          </View>

          {signUp && (
            <>
              <Field label="Name" icon={['person', 'person']} value={name} onChangeText={setName} autoComplete="name" />
              <Field
                label="Phone (optional)"
                icon={['phone', 'call']}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </>
          )}
          <Field
            label="Email"
            icon={['envelope', 'mail']}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Password"
            icon={['key', 'key']}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={signUp ? 'new-password' : 'current-password'}
          />
          {signUp && (
            <Field
              label="Confirm Password"
              icon={['key', 'key']}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
            />
          )}

          {!signUp && (
            <Pressable onPress={resetPassword} style={{ alignSelf: 'flex-end', paddingVertical: spacing.xs }}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </Pressable>
          )}

          {mismatch ? <Text style={styles.message}>The passwords don't match.</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {signUp ? (
            <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.xl }}>
              <GradientButton
                title="Sign Up"
                onPress={submit}
                busy={busy}
                style={{ width: 200 }}
                disabled={!name || !email || !password || confirm !== password}
              />
              <Pressable onPress={() => switchMode('sign-in')} style={{ padding: spacing.sm }}>
                <Text style={styles.linkText}>I am already a member</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => switchMode('sign-up')}
                style={({ pressed }) => [styles.outlineButton, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.outlineText}>Sign Up</Text>
              </Pressable>
              <GradientButton title="Log In" onPress={submit} busy={busy} style={{ flex: 1 }} disabled={!email || !password} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

/** Purple corner shape and circles, after the reference design. */
function Decor() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={300} height={230} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <SvgGradient id="blob" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primaryPressed} />
            <Stop offset="1" stopColor="#B9A4F7" />
          </SvgGradient>
        </Defs>
        <Path d="M0 0 H270 C 270 120 170 200 0 225 Z" fill="url(#blob)" />
      </Svg>
      <View style={[styles.dot, { top: 42, right: 70, width: 56, height: 56, backgroundColor: colors.primary }]} />
      <View style={[styles.dot, { top: 48, right: 28, width: 30, height: 30, backgroundColor: colors.primaryPressed }]} />
      <View style={[styles.dot, { top: 102, right: 48, width: 40, height: 40, backgroundColor: '#B9A4F7' }]} />
    </View>
  );
}

function GradientButton({
  title,
  onPress,
  busy,
  disabled,
  style,
}: {
  style?: object;
  title: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.pill, style, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryPressed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
      />
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.pillText}>{title}</Text>}
    </Pressable>
  );
}

function Field({
  label,
  icon,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; icon: [ios: string, material: string] }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput placeholderTextColor={colors.textFaint} style={styles.input} {...props} />
        <Icon ios={icon[0]} material={icon[1]} color={colors.primary} size={20} />
      </View>
    </View>
  );
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
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, paddingTop: 240, gap: spacing.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  greeting: { fontSize: 22, color: colors.textMuted },
  title: { fontSize: 40, fontWeight: '800', color: colors.text, letterSpacing: 1 },
  field: { gap: 2 },
  label: { fontSize: 13, color: colors.textMuted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  input: { flex: 1, height: 44, color: colors.text, fontSize: 16, outlineStyle: 'none' } as object,
  linkText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  message: { color: colors.warning, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl },
  pill: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  outlineButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  dot: { position: 'absolute', borderRadius: 999 },
});
