import { colors, spacing } from '@chester/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, StatusBadge } from '@/components/staff';
import { Avatar, Card, Empty, Icon, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMyPatients, usePractitioners } from '@/lib/staff-queries';

/** The practitioner's care-team patients, searchable by name or email. Tap one to open the file. */
export default function Patients() {
  const { user } = useAuth();
  const { t, formatDate, dir } = useI18n();
  const { data: patients, loading } = useMyPatients(user?.id);
  const { data: practitioners } = usePractitioners();
  const [search, setSearch] = useState('');

  const shown = patients
    .filter((p) => `${p.display_name} ${p.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const practitionerName = (id: string | null) => practitioners.find((p) => p.id === id)?.display_name ?? '—';

  return (
    <Screen>
      <Text variant="title">{t('navPatients')}</Text>
      <Field
        placeholder={t('searchPatients')}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {loading ? <Text variant="muted">{t('loading')}</Text> : null}
      {!loading && shown.length === 0 ? <Empty text={t('none')} /> : null}

      {shown.map((p) => (
        <Card
          key={p.id}
          onPress={() => router.push({ pathname: '/staff/patient/[id]', params: { id: p.id } })}
          style={{ gap: spacing.md }}>
          <View style={styles.row}>
            <Avatar name={p.display_name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" numberOfLines={1}>
                {p.display_name}
              </Text>
              {/* Emails read left to right even in Arabic. */}
              <Text variant="small" numberOfLines={1} style={{ writingDirection: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                {p.email}
              </Text>
            </View>
            <StatusBadge status={p.status} />
            <Icon
              ios={dir === 'rtl' ? 'chevron.left' : 'chevron.right'}
              material={dir === 'rtl' ? 'chevron_left' : 'chevron_right'}
              color={colors.textMuted}
              size={18}
            />
          </View>
          <View style={styles.facts}>
            <Fact label={t('sessionsDone')} value={String(p.completed_sessions ?? 0)} />
            <Fact label={t('lastSession')} value={p.last_session_at ? formatDate(p.last_session_at) : '—'} />
            <Fact label={t('primaryPractitioner')} value={practitionerName(p.primary_practitioner_id)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

/** One label/value pair under a patient's name (the web table's columns). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2, minWidth: 90, flexShrink: 1 }}>
      <Text variant="small">{label}</Text>
      <Text numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
