import { colors, radius, spacing, type AssessmentAssignment, type AssessmentForm } from '@chester/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Empty, Loading, Screen, Text } from '@/components/ui';
import { db } from '@/lib/firebase';
import { useDocument } from '@/lib/hooks';

const EMERGENCY_NUMBER = process.env.EXPO_PUBLIC_EMERGENCY_NUMBER ?? '911';

export default function AssessmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: assignment, loading } = useDocument<AssessmentAssignment>(`assessmentAssignments/${id}`);
  const { data: form } = useDocument<AssessmentForm>(assignment ? `assessmentForms/${assignment.formId}` : null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  if (loading || (assignment && !form)) return <Loading />;
  if (!assignment || !form) return <Screen><Empty text="This check-in is no longer available." /></Screen>;

  if (assignment.status === 'completed') {
    return (
      <Screen>
        <Text variant="title">Thank you</Text>
        <Text variant="muted">Your answers were sent to your practitioner, who will go through them with you.</Text>
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  const answered = form.questions.filter((q) => answers[q.id] !== undefined).length;
  const complete = answered === form.questions.length;

  async function submit() {
    setBusy(true);
    try {
      // Scoring happens in a Cloud Function; the patient only submits answers.
      await updateDoc(doc(db, 'assessmentAssignments', id), {
        answers,
        status: 'completed',
        completedAt: serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Could not submit', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">{form.title}</Text>
      <Text variant="muted">{form.instructions}</Text>
      <Text variant="small">
        {answered} of {form.questions.length} answered
      </Text>

      {form.questions.map((q, i) => (
        <Card key={q.id} style={{ gap: spacing.md }}>
          <Text variant="heading">
            {i + 1}. {q.text}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {q.options.map((o) => {
              const selected = answers[q.id] === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setAnswers({ ...answers, [q.id]: o.value })}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}

      {form.safetyItems?.some((sid) => (answers[sid] ?? 0) > 0) && (
        <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
          <Text variant="heading" style={{ color: colors.danger }}>
            You don't have to wait for your next session
          </Text>
          <Text style={{ marginTop: 6 }}>
            If you are thinking about harming yourself, please contact local emergency services or go to the
            nearest emergency department now.
          </Text>
          <Pressable onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)} style={{ marginTop: spacing.sm }}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Call emergency services ({EMERGENCY_NUMBER})</Text>
          </Pressable>
        </Card>
      )}

      <Button title="Submit" onPress={submit} disabled={!complete} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  optionSelected: { backgroundColor: colors.primary },
});
