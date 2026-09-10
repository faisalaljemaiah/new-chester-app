import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Avatar } from '@/components/avatar';
import { GroupedList, GroupedRow, Chevron } from '@/components/grouped-list';
import { PATIENT, SESSION_HISTORY, SPECIALISTS } from '@/data/mock';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const QUICK_ACTIONS: { label: string; icon: SFSymbol }[] = [
  { label: 'Doctors', icon: 'stethoscope' },
  { label: 'Pharmacy', icon: 'pills' },
  { label: 'Records', icon: 'doc.text' },
  { label: 'Chat', icon: 'bubble.left.and.bubble.right' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const nextVisit = SESSION_HISTORY.find((s) => s.status === 'upcoming');
  const lastVisit = SPECIALISTS[2];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.groupedBackground }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar initials={PATIENT.initials} size={40} />
            <View>
              <Text style={[styles.greeting, { color: theme.textTertiary }]}>Good morning</Text>
              <Text style={[styles.name, { color: theme.text }]}>{PATIENT.fullName}</Text>
            </View>
          </View>
          <Pressable style={styles.bellButton} hitSlop={8}>
            <SymbolView name="bell" size={22} tintColor={theme.primary} />
            <View style={[styles.dot, { backgroundColor: theme.primary, borderColor: theme.groupedBackground }]} />
          </Pressable>
        </View>

        <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
          <View style={[styles.heroBlob, styles.heroBlobA]} />
          <View style={[styles.heroBlob, styles.heroBlobB]} />
          <Text style={styles.heroEyebrow}>New Chester</Text>
          <Text style={styles.heroTitle}>Book your doctor, any time, anywhere</Text>
          <Pressable style={styles.heroButton} onPress={() => router.push('/booking')}>
            <Text style={[styles.heroButtonLabel, { color: theme.primaryDeep }]}>Get started</Text>
          </Pressable>
          <View style={styles.heroIcon}>
            <SymbolView name="checkmark.shield" size={26} tintColor="#fff" />
          </View>
        </View>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              style={styles.quickAction}
              onPress={() => (action.label === 'Chat' ? router.push('/(tabs)/chat') : router.push('/booking'))}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.background }]}>
                <SymbolView name={action.icon} size={21} tintColor={theme.primary} />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Specialists</Text>
          <Pressable onPress={() => router.push('/booking')}>
            <Text style={[styles.sectionLink, { color: theme.primary }]}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.specialistRow}>
          {SPECIALISTS.map((doc) => (
            <Pressable key={doc.id} style={[styles.specialistCard, { backgroundColor: theme.card }]} onPress={() => router.push('/booking')}>
              <Avatar initials={doc.initials} size={44} />
              <Text style={[styles.specialistName, { color: theme.text }]} numberOfLines={1}>
                {doc.name}
              </Text>
              <Text style={[styles.specialistSpecialty, { color: theme.textTertiary }]} numberOfLines={1}>
                {doc.specialty}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: theme.text }]}>Activity</Text>
        <GroupedList>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <GroupedRow>
              <Avatar initials={lastVisit.initials} size={42} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{lastVisit.name}</Text>
                <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>Last visit · Aug 24</Text>
              </View>
              <View style={styles.rowStat}>
                <SymbolView name="star.fill" size={12} tintColor={theme.primary} />
                <Text style={[styles.rowStatLabel, { color: theme.text }]}>{lastVisit.rating.toFixed(1)}</Text>
              </View>
              <Chevron />
            </GroupedRow>
          </Pressable>
          {nextVisit && (
            <Pressable onPress={() => router.push('/(tabs)/profile')}>
              <GroupedRow last>
                <View style={[styles.dateBadge, { backgroundColor: theme.primaryPale }]}>
                  <Text style={[styles.dateMonth, { color: theme.primary }]}>{nextVisit.month}</Text>
                  <Text style={[styles.dateDay, { color: theme.text }]}>{nextVisit.day}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{nextVisit.doctorName}</Text>
                  <Text style={[styles.rowSubtitle, { color: theme.textTertiary }]}>{nextVisit.note}</Text>
                </View>
                <Text style={[styles.detailsLink, { color: theme.primary }]}>Details</Text>
                <Chevron />
              </GroupedRow>
            </Pressable>
          )}
        </GroupedList>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 13, fontFamily: Fonts.sans },
  name: { fontSize: 20, fontWeight: '700', fontFamily: Fonts.sans },
  bellButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5 },

  heroCard: { marginTop: 18, borderRadius: Radius.xl, padding: 22, overflow: 'hidden' },
  heroBlob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroBlobA: { top: -40, right: -30, width: 140, height: 140 },
  heroBlobB: { bottom: -50, right: 40, width: 90, height: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroEyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.sans },
  heroTitle: { fontSize: 21, fontWeight: '700', color: '#fff', lineHeight: 27, marginTop: 6, maxWidth: 210, fontFamily: Fonts.sans },
  heroButton: { marginTop: 14, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.md },
  heroButtonLabel: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans },
  heroIcon: { position: 'absolute', right: 16, bottom: 16, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },

  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  quickAction: { alignItems: 'center', gap: 6, width: 72 },
  quickActionIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 11, fontWeight: '500', fontFamily: Fonts.sans },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', fontFamily: Fonts.sans },
  sectionTitleSpaced: { marginTop: 24, marginBottom: 12 },
  sectionLink: { fontSize: 15, fontFamily: Fonts.sans },

  specialistRow: { marginTop: 12 },
  specialistCard: { width: 122, borderRadius: Radius.lg, padding: 14, marginRight: 10, alignItems: 'center', gap: 8 },
  specialistName: { fontSize: 12.5, fontWeight: '600', fontFamily: Fonts.sans, textAlign: 'center' },
  specialistSpecialty: { fontSize: 10.5, fontFamily: Fonts.sans, textAlign: 'center' },

  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.sans },
  rowSubtitle: { fontSize: 12.5, marginTop: 1, fontFamily: Fonts.sans },
  rowStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowStatLabel: { fontSize: 12.5, fontWeight: '600', fontFamily: Fonts.sans },
  detailsLink: { fontSize: 12.5, fontWeight: '600', fontFamily: Fonts.sans },

  dateBadge: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', fontFamily: Fonts.sans },
  dateDay: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
});
