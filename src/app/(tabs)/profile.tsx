import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Avatar } from '@/components/avatar';
import { GroupedList, GroupedRow, Chevron } from '@/components/grouped-list';
import { ProgressRing } from '@/components/progress-ring';
import { PATIENT, PRIMARY_PROVIDER, SESSIONS_TOTAL, SESSIONS_USED, SESSION_HISTORY } from '@/data/mock';
import { Fonts, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const doctor = PRIMARY_PROVIDER;
  const progress = SESSIONS_USED / SESSIONS_TOTAL;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.groupedBackground }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>My care</Text>
          <Avatar initials={PATIENT.initials} size={40} />
        </View>

        <View style={[styles.sessionsCard, { backgroundColor: theme.primary }]}>
          <View style={[styles.blob]} />
          <View style={styles.sessionsRow}>
            <View>
              <Text style={styles.sessionsLabel}>Sessions with {doctor.name.split(' ').slice(-1)[0]}</Text>
              <Text style={styles.sessionsCount}>
                {SESSIONS_USED} <Text style={styles.sessionsTotal}>of {SESSIONS_TOTAL} used</Text>
              </Text>
            </View>
            <ProgressRing
              size={56}
              strokeWidth={6}
              progress={progress}
              trackColor="rgba(255,255,255,0.25)"
              progressColor="#fff"
            />
          </View>
          <Text style={styles.sessionsNote}>
            Session count is set by your practitioner and updates after each visit.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your care team</Text>
        <View style={[styles.careTeamCard, { backgroundColor: theme.card }]}>
          <Avatar initials={doctor.initials} size={46} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{doctor.name}</Text>
            <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>
              {doctor.title} · Primary provider
            </Text>
          </View>
          <Pressable style={[styles.messageButton, { backgroundColor: theme.primaryPale }]}>
            <SymbolView name="bubble.left.and.bubble.right" size={16} tintColor={theme.primary} />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: theme.text }]}>Session history</Text>
        <GroupedList>
          {SESSION_HISTORY.map((session, i) => (
            <Pressable key={session.id}>
              <GroupedRow last={i === SESSION_HISTORY.length - 1}>
                <View
                  style={[
                    styles.dateBadge,
                    { backgroundColor: session.status === 'upcoming' ? theme.primaryPale : theme.backgroundElement },
                  ]}>
                  <Text
                    style={[
                      styles.dateMonth,
                      { color: session.status === 'upcoming' ? theme.primary : theme.textTertiary },
                    ]}>
                    {session.month}
                  </Text>
                  <Text style={[styles.dateDay, { color: theme.text }]}>{session.day}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{session.doctorName}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>{session.note}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: session.status === 'upcoming' ? theme.primaryPale : theme.backgroundElement },
                  ]}>
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: session.status === 'upcoming' ? theme.primaryDeep : theme.textSecondary },
                    ]}>
                    {STATUS_LABEL[session.status]}
                  </Text>
                </View>
                <Chevron />
              </GroupedRow>
            </Pressable>
          ))}
        </GroupedList>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: theme.text }]}>Account</Text>
        <GroupedList>
          <GroupedRow last>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Signed in as</Text>
              <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>{session?.user.email}</Text>
            </View>
          </GroupedRow>
        </GroupedList>
        <Pressable onPress={signOut} style={[styles.signOutButton, { backgroundColor: theme.card }]}>
          <Text style={[styles.signOutLabel, { color: theme.danger }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontWeight: '700', fontFamily: Fonts.sans },

  sessionsCard: { marginTop: 16, borderRadius: Radius.xl, padding: 22, overflow: 'hidden' },
  blob: { position: 'absolute', top: -36, right: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  sessionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionsLabel: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.sans },
  sessionsCount: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 4, fontFamily: Fonts.sans },
  sessionsTotal: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  sessionsNote: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 12, lineHeight: 16, fontFamily: Fonts.sans },

  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 24, fontFamily: Fonts.sans },
  sectionTitleSpaced: { marginBottom: 12 },

  careTeamCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: 16, marginTop: 12 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.sans },
  rowSubtitle: { fontSize: 12.5, marginTop: 1, fontFamily: Fonts.sans },
  messageButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  dateBadge: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', fontFamily: Fonts.sans },
  dateDay: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  statusLabel: { fontSize: 11.5, fontWeight: '600', fontFamily: Fonts.sans },

  signOutButton: { marginTop: 12, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
  signOutLabel: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.sans },
});
