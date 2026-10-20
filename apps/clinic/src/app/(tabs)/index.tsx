import { colors, radius, spacing, type Practitioner } from '@chester/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInView, PressableScale } from '@/components/motion';
import { Avatar, Card, Empty, Icon, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { firstName, formatDate, formatTime, greeting } from '@/lib/format';
import { useMyAppointments, usePractitioners } from '@/lib/queries';

const services = [
  { key: 'psychiatry', label: 'Psychiatry', ios: 'cross.case', material: 'medication' },
  { key: 'psychology', label: 'Psychology', ios: 'brain.head.profile', material: 'psychology' },
  { key: 'messages', label: 'Messages', ios: 'bubble.left', material: 'chat_bubble' },
  { key: 'forms', label: 'Check-ins', ios: 'list.clipboard', material: 'assignment' },
] as const;

/** Dark plum of the "Who we are" banner; banner-doctor.jpg fades into this colour on its left edge. */
const bannerColor = '#241B3F';

/** Patient home, laid out after fai's reference: brand header, "Who we are" banner, services, then the practitioners. */
export default function Home() {
  const { user, patient } = useAuth();
  const [discipline, setDiscipline] = useState<Practitioner['discipline'] | null>(null);
  const { data: practitioners } = usePractitioners();
  const { data: appointments } = useMyAppointments(user?.id);
  const scroll = useRef<ScrollViewInstance>(null);
  const [teamY, setTeamY] = useState(0);

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'scheduled' && Date.parse(a.end_at) > Date.now())
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0],
    [appointments],
  );
  const shown = practitioners.filter((p) => !discipline || p.discipline === discipline);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
          <Avatar name={patient?.display_name ?? '?'} size={40} />
        </PressableScale>
        <Text style={styles.brand}>NEW CHESTER</Text>
        <PressableScale onPress={() => router.push('/(tabs)/messages')} style={styles.iconButton} hitSlop={8}>
          <Icon ios="bell" material="notifications" color={colors.text} size={22} />
        </PressableScale>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hello}>
          {greeting()}, {firstName(patient?.display_name) || 'there'} 👋
        </Text>

        {/* Who we are */}
        <FadeInView index={0} style={styles.banner}>
          <Image source={require('../../../assets/images/banner-doctor.jpg')} style={styles.bannerPhoto} contentFit="cover" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerEyebrow}>WHO WE ARE</Text>
            <Text style={styles.bannerTitle}>A family-run clinic</Text>
            <Text style={styles.bannerBody}>Heart-to-heart care, where you're treated like family.</Text>
            <PressableScale
              onPress={() => scroll.current?.scrollTo({ y: teamY, animated: true })}
              style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Meet our team</Text>
            </PressableScale>
          </View>
        </FadeInView>

        <FadeInView index={1} style={styles.services}>
          {services.map((s) => {
            const active = discipline === s.key;
            return (
              <PressableScale
                key={s.key}
                style={styles.service}
                onPress={() => {
                  if (s.key === 'messages') return router.push('/(tabs)/messages');
                  if (s.key === 'forms') return router.push('/(tabs)/profile');
                  setDiscipline(active ? null : s.key);
                }}>
                <View style={[styles.serviceIcon, active && { backgroundColor: colors.primary }]}>
                  <Icon ios={s.ios} material={s.material} color={active ? colors.onPrimary : colors.primary} />
                </View>
                <Text variant="small" style={{ color: colors.text }}>
                  {s.label}
                </Text>
              </PressableScale>
            );
          })}
        </FadeInView>

        {upcoming && (
          <Card onPress={() => router.push(`/session/${upcoming.id}`)} style={styles.row}>
            <View style={styles.upcomingIcon}>
              <Icon ios="calendar" material="event" color={colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small">Your next session</Text>
              <Text variant="heading">{upcoming.practitioner_name}</Text>
              <Text variant="small">
                {formatDate(upcoming.start_at)} · {formatTime(upcoming.start_at)}
              </Text>
            </View>
            <Icon ios="chevron.right" material="chevron_right" color={colors.textMuted} size={18} />
          </Card>
        )}

        <View onLayout={(e) => setTeamY(e.nativeEvent.layout.y - spacing.md)} style={{ gap: 4 }}>
          <Text style={styles.sectionTitle}>Meet our practitioners</Text>
          <Text variant="muted">The people who will look after you and your family.</Text>
        </View>
        {shown.length === 0 ? <Empty text="No practitioners in this area yet." /> : null}
        {shown.map((p, i) => (
          <FadeInView key={p.id} index={i + 3}>
            <PractitionerCard p={p} />
          </FadeInView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PractitionerCard({ p }: { p: Practitioner }) {
  const open = () => router.push(`/practitioner/${p.id}`);
  const initials = p.display_name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <PressableScale onPress={open} scaleTo={0.98} style={styles.doctorCard}>
      {p.photo_url ? (
        <Image source={{ uri: p.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient
          colors={['#B9A4F7', colors.primary, colors.primaryPressed]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.doctorPlaceholder]}>
          <Text style={styles.initials}>{initials}</Text>
        </LinearGradient>
      )}
      <LinearGradient colors={['rgba(20,16,40,0)', 'rgba(20,16,40,0.75)']} style={styles.doctorShade} />

      <View style={styles.doctorTop}>
        <View style={styles.badge}>
          <Icon ios="checkmark.seal.fill" material="verified" color={colors.primary} size={14} />
          <Text style={styles.badgeText}>{p.discipline === 'psychiatry' ? 'Psychiatry' : 'Psychology'}</Text>
        </View>
        <View style={styles.badge}>
          <Icon ios="clock" material="schedule" color={colors.primary} size={14} />
          <Text style={styles.badgeText}>{p.session_minutes} min</Text>
        </View>
      </View>

      <View style={styles.doctorBottom}>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>{p.display_name}</Text>
          <Text style={styles.doctorTitle}>{p.title}</Text>
        </View>
        <PressableScale onPress={open} style={styles.bookButton}>
          <Text style={styles.bookText}>Book Now</Text>
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  brand: { fontSize: 16, fontWeight: '700', letterSpacing: 2, color: colors.text },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.lg },
  hello: { fontSize: 15, color: colors.textMuted },

  banner: { height: 190, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: bannerColor },
  bannerPhoto: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%' },
  bannerText: { flex: 1, width: '62%', padding: spacing.xl, justifyContent: 'center', gap: 4 },
  bannerEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#B9A4F7' },
  bannerTitle: { fontSize: 22, lineHeight: 27, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.4 },
  bannerBody: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.8)' },
  bannerButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
  },
  bannerButtonText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  services: { flexDirection: 'row', justifyContent: 'space-between' },
  service: { alignItems: 'center', gap: spacing.sm, width: 76 },
  serviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  upcomingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },

  doctorCard: { height: 230, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.primary },
  doctorPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 72, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: -2 },
  doctorShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  doctorTop: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.text },
  doctorBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.lg,
  },
  doctorName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.4 },
  doctorTitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  bookButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  bookText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
