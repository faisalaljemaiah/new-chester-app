import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Avatar } from '@/components/avatar';
import { PrimaryButton, SecondaryButton } from '@/components/buttons';
import { GroupedList, GroupedRow } from '@/components/grouped-list';
import { PRIMARY_PROVIDER } from '@/data/mock';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ResultScreen() {
  const theme = useTheme();
  const doctor = PRIMARY_PROVIDER;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <SymbolView name="chevron.left" size={18} weight="semibold" tintColor={theme.primary} />
        </Pressable>

        <View style={[styles.checkCircle, { backgroundColor: theme.primaryPale }]}>
          <SymbolView name="checkmark" size={26} weight="bold" tintColor={theme.primary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>
          We recommend{'\n'}
          <Text style={{ color: theme.primary }}>{doctor.name}</Text>
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Based on your answers, she&apos;s a strong fit for anxiety &amp; stress support — and has an opening this
          week.
        </Text>

        <View style={styles.listWrap}>
          <GroupedList>
            <GroupedRow>
              <Avatar initials={doctor.initials} size={46} />
              <View>
                <Text style={[styles.doctorName, { color: theme.text }]}>{doctor.name}</Text>
                <Text style={[styles.doctorMeta, { color: theme.textTertiary }]}>
                  {doctor.title} · {doctor.specialty}
                </Text>
              </View>
            </GroupedRow>
            <GroupedRow last>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <SymbolView name="star.fill" size={13} tintColor={theme.primary} />
                  <Text style={[styles.statLabel, { color: theme.text }]}>
                    {doctor.rating.toFixed(1)} ({doctor.reviews})
                  </Text>
                </View>
                <View style={styles.stat}>
                  <SymbolView name="briefcase" size={13} tintColor={theme.primary} />
                  <Text style={[styles.statLabel, { color: theme.text }]}>{doctor.yearsExperience} yrs exp</Text>
                </View>
                <View style={styles.stat}>
                  <SymbolView name="graduationcap" size={13} tintColor={theme.primary} />
                  <Text style={[styles.statLabel, { color: theme.text }]}>{doctor.school}</Text>
                </View>
              </View>
            </GroupedRow>
          </GroupedList>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title={`Book with ${doctor.name.split(' ').slice(-1)[0]}`} onPress={() => router.replace('/(tabs)')} />
        <SecondaryButton title="See other specialists" onPress={() => router.push('/booking')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', height: 44, width: 44, justifyContent: 'center' },
  checkCircle: {
    marginTop: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginTop: 20,
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 290,
    fontFamily: Fonts.sans,
  },
  listWrap: { width: '100%', marginTop: 26 },
  doctorName: { fontSize: 16, fontWeight: '600', fontFamily: Fonts.sans },
  doctorMeta: { fontSize: 13, marginTop: 1, fontFamily: Fonts.sans },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', flex: 1 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 13, fontWeight: '500', fontFamily: Fonts.sans },
  footer: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
});
