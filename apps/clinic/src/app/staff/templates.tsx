import { colors, spacing } from '@chester/shared';
import type { Locale, MessageTemplate, TemplateKind } from '@chester/shared';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';

import { Badge, BackHeader, Choice, Field, Row, Sheet } from '@/components/staff';
import { Button, Card, Empty, Icon, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useForms, useTemplates } from '@/lib/staff-queries';
import { must, supabase } from '@/lib/supabase';

/** Shows an error; Alert has no UI on web. */
function showError(title: string, e: unknown) {
  const message = (e as Error)?.message ?? String(e);
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}

/** Asks before a destructive action. */
function confirm(title: string, ok: string, back: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onOk();
    return;
  }
  Alert.alert(title, undefined, [
    { text: back, style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

/** Clinic templates plus the practitioner's own, with a sheet to create or edit one. */
export default function Templates() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  // Templates aren't broadcast by Realtime, so reload the list after each change.
  const { data: templates, refresh } = useTemplates(user?.id);
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);

  const remove = (tpl: MessageTemplate) =>
    confirm(`${t('delete')}: ${tpl.title}?`, t('delete'), t('cancel'), () => {
      must(supabase.from('templates').delete().eq('id', tpl.id))
        .then(refresh)
        .catch((e) => showError(t('error'), e));
    });

  return (
    <Screen>
      <BackHeader title={t('navTemplates')} />
      <Button title={`+ ${t('newTemplate')}`} onPress={() => setEditing('new')} />

      {templates.length === 0 ? <Empty text={t('none')} /> : null}
      {templates.map((tpl) => {
        const canEdit = isAdmin || tpl.owner_id === user?.id;
        return (
          <Card key={tpl.id} style={styles.stack}>
            <Row>
              <Icon
                ios={tpl.kind === 'assessment' ? 'list.clipboard' : 'envelope'}
                material={tpl.kind === 'assessment' ? 'assignment' : 'mail'}
                color={colors.primary}
                size={20}
              />
              <Text variant="heading" style={{ flex: 1 }}>
                {tpl.title}
              </Text>
            </Row>
            <Row gap={spacing.sm}>
              <Badge label={tpl.shared ? t('sharedTemplate') : t('myTemplate')} tone="neutral" />
              <Badge label={tpl.locale === 'ar' ? t('arabic') : t('english')} tone="neutral" />
            </Row>
            <Text variant="muted" style={{ writingDirection: tpl.locale === 'ar' ? 'rtl' : 'ltr' }}>
              {tpl.body}
            </Text>
            {canEdit ? (
              <Row>
                <View style={{ flex: 1 }}>
                  <Button title={t('edit')} variant="secondary" onPress={() => setEditing(tpl)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={t('delete')} variant="danger" onPress={() => remove(tpl)} />
                </View>
              </Row>
            ) : null}
          </Card>
        );
      })}

      {editing ? (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
    </Screen>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const { data: forms } = useForms();
  const [title, setTitle] = useState(template?.title ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [kind, setKind] = useState<TemplateKind>(template?.kind ?? 'message');
  const [formId, setFormId] = useState(template?.form_id ?? '');
  const [locale, setLocale] = useState<Locale>(template?.locale ?? 'en');
  const [shared, setShared] = useState(template?.shared ?? false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      const data = {
        title: title.trim(),
        body: body.trim(),
        kind,
        locale,
        shared: isAdmin && shared,
        form_id: kind === 'assessment' ? formId : null,
      };
      // owner_id defaults to the signed-in practitioner.
      if (template) await must(supabase.from('templates').update(data).eq('id', template.id));
      else await must(supabase.from('templates').insert(data));
      await onSaved();
      onClose();
    } catch (e) {
      showError(t('error'), e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={template ? t('edit') : t('newTemplate')} onClose={onClose}>
      <Choice
        label={t('kind')}
        value={kind}
        options={[
          { value: 'message', label: t('messageTemplate') },
          { value: 'assessment', label: t('assessmentTemplate') },
        ]}
        onChange={setKind}
      />
      {kind === 'assessment' ? (
        <Choice label={t('form')} value={formId || null} options={forms.map((f) => ({ value: f.id, label: f.code }))} onChange={setFormId} />
      ) : null}
      <Field label={t('title')} value={title} onChangeText={setTitle} />
      <Choice
        label={t('templateLanguage')}
        value={locale}
        options={[
          { value: 'en', label: t('english') },
          { value: 'ar', label: t('arabic') },
        ]}
        onChange={setLocale}
      />
      <Field
        label={t('body')}
        value={body}
        multiline
        onChangeText={setBody}
        style={{ textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}
      />
      {isAdmin ? (
        <Row>
          <Text style={{ flex: 1 }}>{t('sharedTemplate')}</Text>
          <Switch value={shared} onValueChange={setShared} trackColor={{ true: colors.primary, false: colors.surfaceRaised }} />
        </Row>
      ) : null}
      <Button
        title={t('save')}
        loading={busy}
        disabled={!title.trim() || !body.trim() || (kind === 'assessment' && !formId)}
        onPress={() => void save()}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
});
