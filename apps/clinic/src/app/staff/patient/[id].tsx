import {
  colors,
  radius,
  spacing,
  type Appointment,
  type AssessmentAssignment,
  type AssessmentResult,
  type ChatMessage,
  type ClinicalNote,
  type Conversation,
  type Patient,
  type PatientStatus,
  type PatientTask,
} from '@chester/shared';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScoreChart } from '@/components/ScoreChart';
import { Badge, BackHeader, Choice, Field, Row, Segmented, SeverityBadge, Sheet, StatusBadge } from '@/components/staff';
import { Avatar, Button, Card, Empty, Icon, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLive, useRows } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { useForms, usePractitioners, useTemplates } from '@/lib/staff-queries';
import { must, rpc, supabase } from '@/lib/supabase';

type Tab = 'progress' | 'notes' | 'tasks' | 'assessments' | 'messages' | 'sessions';
const TABS: Tab[] = ['progress', 'notes', 'tasks', 'assessments', 'messages', 'sessions'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Shows a failed save to the practitioner (Alert has no UI on the web, so use the browser's). */
function showError(e: unknown, fallback: string) {
  const message = e instanceof Error && e.message ? e.message : fallback;
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(message);
}

/** Asks before deleting. */
function confirmDelete(title: string, detail: string, labels: { ok: string; cancel: string }, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}: ${detail}`)) onYes();
    return;
  }
  Alert.alert(title, detail, [
    { text: labels.cancel, style: 'cancel' },
    { text: labels.ok, style: 'destructive', onPress: onYes },
  ]);
}

/** The patient file: status, progress, notes, to-dos, assessments, chat and session history. */
export default function PatientFile() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const patientId = params.id ?? '';
  const { t, formatDate, dir } = useI18n();
  const [tab, setTab] = useState<Tab>(TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'progress');
  const [transferOpen, setTransferOpen] = useState(false);
  const { data: patient, loading } = useLive<Patient>(
    patientId ? `patient:${patientId}` : null,
    () => supabase.from('patients').select('*').eq('id', patientId).maybeSingle(),
    ['patients'],
  );
  const { data: practitioners } = usePractitioners();
  const { data: appointments } = useRows<Appointment>(
    patientId ? `patient-appointments:${patientId}` : null,
    () =>
      supabase.from('appointments').select('*').eq('patient_id', patientId).order('start_at', { ascending: false }),
    ['appointments'],
  );

  if (loading || !patient) {
    return (
      <Screen>
        <BackHeader title={t('navPatients')} />
        {loading ? <Text variant="muted">{t('loading')}</Text> : <Empty text={t('none')} />}
      </Screen>
    );
  }

  const upcoming = appointments.filter((a) => a.status === 'scheduled' && Date.parse(a.end_at) > Date.now());
  const primary = practitioners.find((p) => p.id === patient.primary_practitioner_id);

  const header = <BackHeader title={patient.display_name} />;
  const tabs = (
    <Segmented
      value={tab}
      onChange={setTab}
      options={[
        { value: 'progress', label: t('progress') },
        { value: 'notes', label: t('notes') },
        { value: 'tasks', label: t('tasks') },
        { value: 'assessments', label: t('assessments') },
        { value: 'messages', label: t('messages') },
        { value: 'sessions', label: t('sessions') },
      ]}
    />
  );

  // The chat needs the whole height for its own (inverted) list, so it doesn't sit inside the page scroll.
  if (tab === 'messages') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.fill}>
        <View style={styles.chatTop}>
          {header}
          {tabs}
        </View>
        <MessagesTab patientId={patientId} />
      </SafeAreaView>
    );
  }

  return (
    <Screen>
      {header}
      <Card style={{ gap: spacing.lg }}>
        <Row>
          <Avatar name={patient.display_name} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title" style={{ fontSize: 20 }}>
              {patient.display_name}
            </Text>
            {/* Email and phone read left to right even in Arabic. */}
            <Text variant="small" style={{ writingDirection: 'ltr', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              {patient.email}
              {patient.phone ? ` · ${patient.phone}` : ''}
            </Text>
            <Text variant="small">
              {t('primaryPractitioner')}: {primary?.display_name ?? '—'}
            </Text>
          </View>
        </Row>
        <Choice<PatientStatus>
          label={t('status')}
          value={patient.status}
          options={(['active', 'on_hold', 'discharged'] as const).map((s) => ({ value: s, label: t(s) }))}
          onChange={(s) =>
            must(supabase.from('patients').update({ status: s }).eq('id', patientId)).catch((e) => showError(e, t('error')))
          }
        />
        <Button
          title={t('transferPatient')}
          variant="secondary"
          onPress={() => setTransferOpen(true)}
          icon={<Icon ios="arrow.left.arrow.right" material="swap_horiz" size={18} />}
        />
        <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
          <MiniStat label={t('sessionsDone')} value={String(patient.completed_sessions ?? 0)} />
          <MiniStat label={t('upcomingSessions')} value={String(upcoming.length)} />
          <MiniStat label={t('lastSession')} value={patient.last_session_at ? formatDate(patient.last_session_at) : '—'} />
        </Row>
      </Card>

      {tabs}

      {tab === 'progress' && <ProgressTab patientId={patientId} appointments={appointments} />}
      {tab === 'notes' && <NotesTab patientId={patientId} />}
      {tab === 'tasks' && <TasksTab patientId={patientId} />}
      {tab === 'assessments' && <AssessmentsTab patientId={patientId} />}
      {tab === 'sessions' && <SessionsTab appointments={appointments} />}

      {transferOpen && <TransferSheet patientId={patientId} onClose={() => setTransferOpen(false)} />}
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue} numberOfLines={2}>
        {value}
      </Text>
      <Text variant="small">{label}</Text>
    </View>
  );
}

/** Small text button for row actions (delete, mark reviewed), where a full Button is too big. */
function LinkButton({ title, onPress, color = colors.primary }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text variant="small" style={{ color, fontWeight: '600' }}>
        {title}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

function useResults(patientId: string) {
  return useRows<AssessmentResult>(
    `patient-results:${patientId}`,
    () => supabase.from('assessment_results').select('*').eq('patient_id', patientId).order('completed_at'),
    ['assessment_results'],
  );
}

/** This practitioner's conversation with the patient, opened by booking or an accepted transfer. */
function useConversation(patientId: string, practitionerId: string | undefined) {
  return useLive<Conversation>(
    practitionerId ? `conversation:${patientId}:${practitionerId}` : null,
    () =>
      supabase
        .from('conversations')
        .select('*')
        .eq('patient_id', patientId)
        .eq('practitioner_id', practitionerId!)
        .maybeSingle(),
    ['conversations'],
  );
}

function ProgressTab({ patientId, appointments }: { patientId: string; appointments: Appointment[] }) {
  const { t } = useI18n();
  const { data: results } = useResults(patientId);
  const { data: forms } = useForms();

  const byForm = new Map<string, AssessmentResult[]>();
  for (const r of results) byForm.set(r.form_id, [...(byForm.get(r.form_id) ?? []), r]);

  const counts = {
    completed: appointments.filter((a) => a.status === 'completed').length,
    no_show: appointments.filter((a) => a.status === 'no_show').length,
    cancelled: appointments.filter((a) => a.status === 'cancelled').length,
  };

  return (
    <>
      <Card style={{ gap: spacing.lg }}>
        <Text variant="heading">{t('scoreOverTime')}</Text>
        {byForm.size === 0 && <Text variant="muted">{t('noScores')}</Text>}
        {[...byForm.entries()].map(([formId, rs]) => {
          const form = forms.find((f) => f.id === formId);
          return (
            <ScoreChart
              key={formId}
              title={form?.code ?? rs[0].form_code}
              results={rs}
              maxScore={rs[0].max_score}
              bands={form?.bands ?? []}
            />
          );
        })}
      </Card>
      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{t('sessions')}</Text>
        {(['completed', 'no_show', 'cancelled'] as const).map((s) => (
          <Row key={s}>
            <View style={{ flex: 1 }}>
              <StatusBadge status={s} />
            </View>
            <Text style={{ fontWeight: '700' }}>{counts[s]}</Text>
          </Row>
        ))}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function NotesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const { data: notes } = useRows<ClinicalNote>(
    `notes:${patientId}`,
    () => supabase.from('notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
    ['notes'],
  );
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!body.trim() || !user) return;
    setSaving(true);
    try {
      // The author and their name are filled in by the database.
      await must(supabase.from('notes').insert({ patient_id: patientId, body: body.trim() }));
      setBody('');
    } catch (e) {
      showError(e, t('error'));
    } finally {
      setSaving(false);
    }
  }

  function remove(n: ClinicalNote) {
    confirmDelete(t('delete'), n.body.slice(0, 80), { ok: t('delete'), cancel: t('cancel') }, () =>
      must(supabase.from('notes').delete().eq('id', n.id)).catch((e) => showError(e, t('error'))),
    );
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Row gap={spacing.sm}>
        <Icon ios="lock.fill" material="lock" size={14} color={colors.textMuted} />
        <Text variant="small" style={{ flex: 1 }}>
          {t('notesPrivate')}
        </Text>
      </Row>
      <Field placeholder={t('newNote')} value={body} onChangeText={setBody} multiline />
      <Button title={t('addNote')} onPress={add} disabled={!body.trim()} loading={saving} />
      {notes.length === 0 && <Text variant="muted">{t('none')}</Text>}
      {notes.map((n) => (
        <View key={n.id} style={styles.inner}>
          <Row gap={spacing.sm} style={{ marginBottom: 6 }}>
            <Text variant="small" style={{ color: colors.text, fontWeight: '700' }}>
              {n.author_name}
            </Text>
            <Text variant="small" style={{ flex: 1 }}>{`${formatDate(n.created_at)} · ${formatTime(n.created_at)}`}</Text>
            {n.author_id === user?.id && <LinkButton title={t('delete')} color={colors.danger} onPress={() => remove(n)} />}
          </Row>
          <Text>{n.body}</Text>
        </View>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TasksTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data: tasks } = useRows<PatientTask>(
    `tasks:${patientId}`,
    () => supabase.from('tasks').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
    ['tasks'],
  );
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const badDate = dueDate.trim() !== '' && !DATE.test(dueDate.trim());

  async function add() {
    if (!title.trim() || !user || badDate) return;
    setSaving(true);
    try {
      await must(
        supabase.from('tasks').insert({ patient_id: patientId, title: title.trim(), due_date: dueDate.trim() || null }),
      );
      setTitle('');
      setDueDate('');
    } catch (e) {
      showError(e, t('error'));
    } finally {
      setSaving(false);
    }
  }

  function remove(task: PatientTask) {
    confirmDelete(t('delete'), task.title, { ok: t('delete'), cancel: t('cancel') }, () =>
      must(supabase.from('tasks').delete().eq('id', task.id)).catch((e) => showError(e, t('error'))),
    );
  }

  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <Card style={{ gap: spacing.md }}>
      <Field placeholder={t('newTask')} value={title} onChangeText={setTitle} onSubmitEditing={add} returnKeyType="done" />
      <Field
        label={t('dueDate')}
        placeholder="YYYY-MM-DD"
        value={dueDate}
        onChangeText={setDueDate}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      {badDate && (
        <Text variant="small" style={{ color: colors.warning }}>
          {t('dueDate')}: YYYY-MM-DD
        </Text>
      )}
      <Button title={t('add')} onPress={add} disabled={!title.trim() || badDate} loading={saving} />
      {sorted.length === 0 && <Text variant="muted">{t('none')}</Text>}
      {sorted.map((task) => (
        <Row key={task.id} style={styles.listItem}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            onPress={() =>
              must(supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)).catch((e) =>
                showError(e, t('error')),
              )
            }
            style={styles.check}>
            <Icon
              ios={task.done ? 'checkmark.circle.fill' : 'circle'}
              material={task.done ? 'check_circle' : 'radio_button_unchecked'}
              color={task.done ? colors.success : colors.textMuted}
              size={22}
            />
            <Text style={[{ flex: 1 }, task.done && styles.done]}>{task.title}</Text>
          </Pressable>
          {task.due_date && <Badge label={task.due_date} tone="neutral" />}
          <LinkButton title={t('delete')} color={colors.danger} onPress={() => remove(task)} />
        </Row>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Creates the assignment and posts it in the chat, in one step, so the patient can open it from the app. */
async function sendAssessment(opts: { patientId: string; formId: string; text: string; templateId?: string }) {
  await rpc<string>('send_assessment', {
    p_patient: opts.patientId,
    p_form: opts.formId,
    p_text: opts.text,
    p_template: opts.templateId ?? null,
  });
}

function AssessmentsTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t, formatDate } = useI18n();
  const { data: forms } = useForms();
  const { data: results } = useResults(patientId);
  const { data: convo, loading: convoLoading } = useConversation(patientId, user?.id);
  const { data: assignments } = useRows<AssessmentAssignment>(
    `assignments:${patientId}`,
    () =>
      supabase
        .from('assessment_assignments')
        .select('*')
        .eq('patient_id', patientId)
        .order('sent_at', { ascending: false }),
    ['assessment_assignments'],
  );
  const [formId, setFormId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const form = forms.find((f) => f.id === formId);
    if (!form || !user || !convo) return;
    setError(null);
    setSending(true);
    try {
      await sendAssessment({ patientId, formId: form.id, text: form.instructions });
      setFormId('');
    } catch {
      setError(t('error'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <Choice
        label={t('form')}
        value={formId || null}
        options={forms.map((f) => ({ value: f.id, label: `${f.code} · ${f.title}` }))}
        onChange={setFormId}
      />
      <Button title={t('sendAssessment')} onPress={send} disabled={!formId || !convo} loading={sending} />
      {/* The form is delivered as a chat message, so it needs a conversation with this patient. */}
      {!convoLoading && !convo && (
        <Text variant="small" style={styles.notice}>
          {t('noConversation')}
        </Text>
      )}
      {error && (
        <Text variant="small" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      {assignments.length === 0 && <Text variant="muted">{t('none')}</Text>}
      {assignments.map((a) => {
        const r = results.find((x) => x.assignment_id === a.id);
        return (
          <View key={a.id} style={[styles.listItem, { gap: spacing.sm }]}>
            <Row gap={spacing.sm}>
              <Text style={{ fontWeight: '700' }}>{a.form_code}</Text>
              <Text variant="small" style={{ flex: 1 }}>
                {t('sent')} {formatDate(a.sent_at)}
              </Text>
            </Row>
            {r ? (
              <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
                <Text>
                  {t('score')} <Text style={{ fontWeight: '700' }}>{r.score}</Text>/{r.max_score}
                </Text>
                <SeverityBadge level={r.severity_level} label={r.severity} />
                {r.safety_flag && <Badge label={`⚠ ${t('safetyAlerts')}`} tone="danger" />}
                <View style={{ flex: 1 }} />
                {r.reviewed ? (
                  <Badge label={t('reviewed')} tone="success" />
                ) : (
                  <LinkButton
                    title={t('markReviewed')}
                    onPress={() =>
                      must(
                        supabase.from('assessment_results').update({ reviewed: true }).eq('assignment_id', r.assignment_id),
                      ).catch((e) => showError(e, t('error')))
                    }
                  />
                )}
              </Row>
            ) : (
              <Badge label={t('waitingForPatient')} tone="warning" />
            )}
          </View>
        );
      })}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MessagesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { t, formatDate, formatTime } = useI18n();
  const { data: convo, loading } = useConversation(patientId, user?.id);
  const cid = convo?.id ?? null;
  // Newest first, because the list is inverted.
  const { data: messages } = useRows<ChatMessage>(
    cid ? `messages:${cid}` : null,
    () => supabase.from('messages').select('*').eq('conversation_id', cid!).order('created_at', { ascending: false }),
    ['messages'],
  );
  const { data: templates } = useTemplates(user?.id);
  const { data: forms } = useForms();
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const sending = useRef(false);

  if (loading) return null;
  // The conversation is opened when the patient books with you or you accept a transfer.
  if (!convo || !cid || !user) {
    return (
      <View style={styles.chatBody}>
        <Empty text={t('noConversation')} />
      </View>
    );
  }

  const template = templates.find((x) => x.id === templateId);

  async function send() {
    if (!user || !cid || sending.current) return;
    const body = text.trim();
    if (!body) return;
    sending.current = true;
    try {
      if (template?.kind === 'assessment' && template.form_id) {
        const form = forms.find((f) => f.id === template.form_id);
        if (!form) return;
        await sendAssessment({ patientId, formId: form.id, text: body, templateId: template.id });
      } else {
        await must(
          supabase.from('messages').insert({ conversation_id: cid, text: body, template_id: template?.id ?? null }),
        );
      }
      setText('');
      setTemplateId('');
    } catch (e) {
      showError(e, t('error'));
    } finally {
      sending.current = false;
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {messages.length === 0 ? (
        <View style={styles.chatBody}>
          <Empty text={t('none')} />
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const mine = item.sender_id === user.id;
            const fg = mine ? colors.onPrimary : colors.text;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={{ color: fg }}>{item.text}</Text>
                {item.assessment_assignment_id ? (
                  <Row gap={6}>
                    <Icon ios="list.clipboard" material="assignment" color={fg} size={14} />
                    <Text variant="small" style={{ color: fg }}>
                      {t('assessmentTemplate')}
                    </Text>
                  </Row>
                ) : null}
                <Text variant="small" style={{ color: mine ? colors.primarySoft : colors.textFaint, alignSelf: 'flex-end' }}>
                  {`${formatDate(item.created_at)} ${formatTime(item.created_at)}`}
                </Text>
              </View>
            );
          }}
        />
      )}

      {template ? (
        <Row gap={spacing.sm} style={styles.templateBar}>
          <Icon
            ios={template.kind === 'assessment' ? 'list.clipboard' : 'envelope'}
            material={template.kind === 'assessment' ? 'assignment' : 'mail'}
            color={colors.primary}
            size={16}
          />
          <Text variant="small" style={{ flex: 1, color: colors.text }} numberOfLines={1}>
            {template.title}
          </Text>
          <Pressable onPress={() => setTemplateId('')} hitSlop={10} accessibilityLabel={t('cancel')}>
            <Icon ios="xmark" material="close" color={colors.textMuted} size={16} />
          </Pressable>
        </Row>
      ) : null}

      <View style={styles.composer}>
        <Pressable onPress={() => setPickerOpen(true)} style={styles.round} accessibilityLabel={t('sendTemplate')}>
          <Icon ios="doc.text" material="description" color={colors.text} size={18} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('writeMessage')}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={send}
          disabled={!text.trim()}
          style={[styles.round, styles.send, !text.trim() && { opacity: 0.5 }]}
          accessibilityLabel={t('send')}>
          <Icon ios="paperplane.fill" material="send" color={colors.onPrimary} size={18} />
        </Pressable>
      </View>

      <Sheet visible={pickerOpen} title={t('sendTemplate')} onClose={() => setPickerOpen(false)}>
        {templates.length === 0 && <Text variant="muted">{t('none')}</Text>}
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            onPress={() => {
              setTemplateId(tpl.id);
              setText(tpl.body);
              setPickerOpen(false);
            }}
            style={[{ gap: 4 }, tpl.id === templateId && { borderColor: colors.primary }]}>
            <Row gap={spacing.sm}>
              <Icon
                ios={tpl.kind === 'assessment' ? 'list.clipboard' : 'envelope'}
                material={tpl.kind === 'assessment' ? 'assignment' : 'mail'}
                color={colors.primary}
                size={16}
              />
              <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                {tpl.title}
              </Text>
            </Row>
            <Text variant="small" numberOfLines={2}>
              {tpl.body}
            </Text>
          </Card>
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------

function SessionsTab({ appointments }: { appointments: Appointment[] }) {
  const { t, formatDate, formatTime } = useI18n();
  if (appointments.length === 0) return <Empty text={t('none')} />;
  return (
    <Card style={{ gap: spacing.md }}>
      {appointments.map((a, i) => (
        <View key={a.id} style={[{ gap: 6 }, i > 0 && styles.divider]}>
          <Row gap={spacing.sm}>
            <Text style={{ flex: 1, fontWeight: '600' }}>{`${formatDate(a.start_at)} · ${formatTime(a.start_at)}`}</Text>
            <StatusBadge status={a.status} />
          </Row>
          <Text variant="small">{`${a.practitioner_name} · ${t(a.mode)}`}</Text>
        </View>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TransferSheet({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { data: practitioners } = usePractitioners();
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [keepAccess, setKeepAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = practitioners.filter((p) => p.id !== user?.id);
  const target = others.find((p) => p.id === to);

  async function submit() {
    if (!user || !target) return;
    setSaving(true);
    try {
      // The sender and everyone's names are filled in by the database.
      await must(
        supabase.from('transfers').insert({
          patient_id: patientId,
          to_practitioner_id: target.id,
          reason: reason.trim(),
          keep_access: keepAccess,
        }),
      );
      setDone(true);
    } catch {
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible title={t('transferPatient')} onClose={onClose}>
      {done ? (
        <>
          <Text style={styles.notice}>{t('transferSent')}</Text>
          <Button title={t('close')} onPress={onClose} />
        </>
      ) : (
        <>
          <Choice
            label={t('transferTo')}
            value={to || null}
            options={others.map((p) => ({
              value: p.id,
              label: `${(locale === 'ar' && p.display_name_ar) || p.display_name} · ${t(p.discipline)}`,
            }))}
            onChange={setTo}
          />
          <Field label={t('transferReason')} value={reason} onChangeText={setReason} multiline />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: keepAccess }}
            onPress={() => setKeepAccess(!keepAccess)}
            style={styles.check}>
            <Icon
              ios={keepAccess ? 'checkmark.square.fill' : 'square'}
              material={keepAccess ? 'check_box' : 'check_box_outline_blank'}
              color={keepAccess ? colors.primary : colors.textMuted}
            />
            <Text style={{ flex: 1 }}>{t('keepAccess')}</Text>
          </Pressable>
          {error && (
            <Text variant="small" style={{ color: colors.danger }}>
              {error}
            </Text>
          )}
          <Button title={t('transferPatient')} onPress={submit} disabled={!to || !reason.trim()} loading={saving} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  chatTop: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chatBody: { flex: 1, padding: spacing.xl },
  miniStat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    gap: 4,
  },
  miniValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  inner: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.lg },
  listItem: {
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  divider: { paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  done: { textDecorationLine: 'line-through', color: colors.textMuted },
  notice: {
    backgroundColor: colors.primarySoft,
    color: colors.text,
    padding: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.lg, gap: 6 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomEndRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised, borderBottomStartRadius: 4 },
  templateBar: {
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: { backgroundColor: colors.primary },
});
