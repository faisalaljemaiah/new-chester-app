import { spacing } from '@chester/shared';
import type { AssessmentResult } from '@chester/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Badge, Row, SeverityBadge } from '@/components/staff';
import { Button, Card, Empty, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useMyPatients, useMyResults } from '@/lib/staff-queries';
import { must, supabase } from '@/lib/supabase';

/** Shows an error; Alert has no UI on web. */
function showError(title: string, e: unknown) {
  const message = (e as Error)?.message ?? String(e);
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

/** Every result for the practitioner's patients, safety flags and unreviewed first. */
export default function Assessments() {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { data: results, loading } = useMyResults(user?.id);
  const { data: patients } = useMyPatients(user?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const name = (id: string) => patients.find((p) => p.id === id)?.display_name ?? '—';

  // Unreviewed safety flags first, then unreviewed, then newest.
  const rank = (r: AssessmentResult) => (r.reviewed ? 2 : r.safety_flag ? 0 : 1);
  const sorted = [...results].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(b.completed_at) - Date.parse(a.completed_at),
  );

  async function markReviewed(assignmentId: string) {
    setBusy(assignmentId);
    try {
      await must(supabase.from('assessment_results').update({ reviewed: true }).eq('assignment_id', assignmentId));
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{t('navAssessments')}</Text>
        <Text variant="muted">{t('flaggedFirst')}</Text>
      </View>

      {!loading && sorted.length === 0 ? <Empty text={t('none')} /> : null}
      {sorted.map((r) => (
        <Card
          key={r.assignment_id}
          onPress={() => router.push({ pathname: '/staff/patient/[id]', params: { id: r.patient_id, tab: 'assessments' } })}
          style={styles.card}>
          <Row>
            <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>
              {name(r.patient_id)}
            </Text>
            {r.safety_flag ? <Badge label="⚠" tone="danger" /> : null}
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            <Text variant="muted">{r.form_code}</Text>
            <Text variant="muted">·</Text>
            <Text variant="muted">{formatDate(r.completed_at)}</Text>
            <Text variant="muted">·</Text>
            <Text variant="muted">
              {t('score')} {r.score}/{r.max_score}
            </Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <SeverityBadge level={r.severity_level} label={r.severity} />
            {r.reviewed ? <Badge label={t('reviewed')} tone="success" /> : null}
          </Row>
          {!r.reviewed ? (
            <Button
              title={t('markReviewed')}
              variant="secondary"
              loading={busy === r.assignment_id}
              onPress={() => void markReviewed(r.assignment_id)}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
});
