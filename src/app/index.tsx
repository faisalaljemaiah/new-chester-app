import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Logo } from '@/components/logo';
import { PrimaryButton, TextButton } from '@/components/buttons';
import { GroupedList, GroupedRow } from '@/components/grouped-list';
import { QUIZ_OPTIONS } from '@/data/mock';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function QuizScreen() {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  function skipToApp() {
    router.replace('/(tabs)');
  }

  function goToResult() {
    router.push('/result');
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brand}>
            <Logo size={22} />
            <Text style={[styles.brandText, { color: theme.text }]}>New Chester</Text>
          </View>
          <Pressable onPress={skipToApp} hitSlop={8} style={styles.skipButton}>
            <Text style={[styles.skipLabel, { color: theme.primary }]}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                { backgroundColor: i === 0 ? theme.primary : theme.separator },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.progressLabel, { color: theme.textTertiary }]}>Question 1 of 4</Text>

        <Text style={[styles.title, { color: theme.text }]}>What brings you in today?</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Pick what feels closest — we&apos;ll match you to the right kind of care. You can skip this anytime.
        </Text>

        <View style={styles.listWrap}>
          <GroupedList>
            {QUIZ_OPTIONS.map((option, i) => {
              const isSelected = selected === option.id;
              return (
                <Pressable key={option.id} onPress={() => setSelected(option.id)}>
                  <GroupedRow last={i === QUIZ_OPTIONS.length - 1}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                    <View
                      style={[
                        styles.radio,
                        isSelected
                          ? { backgroundColor: theme.primary }
                          : { borderWidth: 1.5, borderColor: theme.chevron },
                      ]}>
                      {isSelected && <SymbolView name="checkmark" size={12} weight="bold" tintColor="#fff" />}
                    </View>
                  </GroupedRow>
                </Pressable>
              );
            })}
          </GroupedList>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="Continue"
          onPress={goToResult}
          disabled={!selected}
          style={!selected ? styles.disabled : undefined}
        />
        <TextButton title="Skip questions, show me a doctor" onPress={skipToApp} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.sans },
  skipButton: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
  skipLabel: { fontSize: 17, fontFamily: Fonts.sans },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 24 },
  progressSegment: { height: 4, flex: 1, borderRadius: 2 },
  progressLabel: { fontSize: 13, marginTop: 8, fontFamily: Fonts.sans },
  title: { fontSize: 29, fontWeight: '700', lineHeight: 35, marginTop: 20, fontFamily: Fonts.sans },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 8, fontFamily: Fonts.sans },
  listWrap: { marginTop: 22 },
  optionLabel: { fontSize: 16, flex: 1, fontFamily: Fonts.sans },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  disabled: { opacity: 0.4 },
});
