import { colors, spacing } from '@chester/shared';
import type { Discipline } from '@chester/shared';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { BackHeader, Choice, Field, Row } from '@/components/staff';
import { Avatar, Button, Card, Empty, Screen, SectionHeader, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { showError } from '@/lib/dialogs';
import { useI18n } from '@/lib/i18n';
import { usePractitioners } from '@/lib/staff-queries';
import { rpc } from '@/lib/supabase';

const blank = { email: '', displayName: '', title: '', discipline: 'psychiatry' as Discipline, admin: false };

/** Admins only: give an existing account practitioner access, and see the team. */
export default function Team() {
  const { isAdmin } = useAuth();
  const { t, locale } = useI18n();
  // The directory isn't broadcast by Realtime, so reload it after adding someone.
  const { data: practitioners, refresh } = usePractitioners();
  const [form, setForm] = useState(blank);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <Screen>
        <BackHeader title={t('navTeam')} />
        <Empty text={t('none')} />
      </Screen>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setAdded(false);
    try {
      // Turns an existing account into a practitioner; the database explains if there's no account yet.
      await rpc<string>('promote_to_practitioner', {
        p_email: form.email.trim(),
        p_display_name: form.displayName.trim(),
        p_title: form.title.trim(),
        p_discipline: form.discipline,
        p_make_admin: form.admin,
      });
      setAdded(true);
      await refresh();
      setForm(blank);
    } catch (e) {
      setError((e as Error).message || t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackHeader title={t('navTeam')} />

      <SectionHeader title={t('addPractitioner')} />
      <Card style={styles.stack}>
        <Text variant="muted">{t('inviteFirst')}</Text>
        <Field
          label={t('name')}
          value={form.displayName}
          onChangeText={(displayName) => setForm({ ...form, displayName })}
        />
        <Field
          label={t('email')}
          value={form.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(email) => setForm({ ...form, email })}
        />
        <Field label={t('jobTitle')} value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
        <Choice
          label={t('discipline')}
          value={form.discipline}
          options={[
            { value: 'psychiatry', label: t('psychiatry') },
            { value: 'psychology', label: t('psychology') },
          ]}
          onChange={(discipline) => setForm({ ...form, discipline })}
        />
        <Row>
          <Text style={{ flex: 1 }}>{t('makeAdmin')}</Text>
          <Switch
            value={form.admin}
            onValueChange={(admin) => setForm({ ...form, admin })}
            trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
          />
        </Row>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Button
          title={t('addPractitioner')}
          loading={busy}
          disabled={!form.email || !form.displayName || !form.title}
          onPress={() => void submit()}
        />
        {added ? <Text style={{ color: colors.success }}>{t('practitionerAdded')}</Text> : null}
      </Card>

      <SectionHeader title={t('navTeam')} />
      {practitioners.map((p) => (
        <Card key={p.id}>
          <Row>
            <Avatar name={p.display_name} uri={p.photo_url} />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{(locale === 'ar' && p.display_name_ar) || p.display_name}</Text>
              <Text variant="small">
                {p.title} · {t(p.discipline)}
              </Text>
            </View>
          </Row>
          <FeeEditor practitionerId={p.id} fee={Number(p.session_fee ?? 0)} onSaved={refresh} />
        </Card>
      ))}
    </Screen>
  );
}

/** Session fee for one practitioner. New bookings use it; past sessions keep the fee they were booked at. */
function FeeEditor({ practitionerId, fee, onSaved }: { practitionerId: string; fee: number; onSaved: () => unknown }) {
  const { t } = useI18n();
  const [value, setValue] = useState(String(fee));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const parsed = Number(value.replace(',', '.'));
  const changed = value.trim() !== '' && !Number.isNaN(parsed) && parsed !== fee;

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await rpc('set_session_fee', { p_practitioner: practitionerId, p_fee: parsed });
      setSaved(true);
      await onSaved();
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.fee}>
      <View style={{ flex: 1 }}>
        <Field label={t('sessionFee')} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
      </View>
      <Button
        title={saved && !changed ? t('feeSaved') : t('setFee')}
        onPress={save}
        disabled={!changed}
        loading={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  fee: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.md },
});
