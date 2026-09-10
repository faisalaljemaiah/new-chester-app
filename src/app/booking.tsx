/* eslint-disable react-hooks/immutability -- Reanimated SharedValues are mutated via `.value` by design; this isn't a React state mutation. */
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PrimaryButton } from '@/components/buttons';
import { SPECIALISTS } from '@/data/mock';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SWIPE_THRESHOLD = 120;
const SCREEN_ROTATION = 12;

export default function BookingScreen() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const advance = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    setIndex((i) => i + 1);
  }, [translateX, translateY]);

  const dismiss = useCallback(
    (direction: 1 | -1) => {
      translateX.value = withTiming(direction * 500, { duration: 220 }, () => {
        runOnJS(advance)();
      });
    },
    [advance, translateX]
  );

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * 500, { duration: 220 }, () => {
          runOnJS(advance)();
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(translateX.value, [-300, 0, 300], [-SCREEN_ROTATION, 0, SCREEN_ROTATION])}deg`,
      },
    ],
  }));

  const doctor = SPECIALISTS[index];
  const nextDoctor = SPECIALISTS[index + 1];

  function bookCurrent() {
    if (!doctor) return;
    Alert.alert('Session booked', `You're booked with ${doctor.name}. We'll send your video link soon.`, [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.groupedBackground }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerButton}>
          <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={theme.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Find your specialist</Text>
        <Pressable hitSlop={8} style={styles.headerButton}>
          <SymbolView name="line.3.horizontal.decrease" size={17} tintColor={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.stack}>
        {!doctor && (
          <View style={styles.emptyState}>
            <SymbolView name="checkmark.circle" size={40} tintColor={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>You&apos;re all caught up</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Check back later for more available specialists.
            </Text>
          </View>
        )}

        {nextDoctor && (
          <View style={[styles.backCard, { backgroundColor: theme.primaryPale, transform: [{ rotate: '-2deg' }] }]} />
        )}

        {doctor && (
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.card, { backgroundColor: theme.card }, cardStyle]}>
              <View style={[styles.photo, { backgroundColor: theme.primary }]}>
                <View style={styles.photoInitials}>
                  <Text style={styles.photoInitialsText}>{doctor.initials}</Text>
                </View>
                <View style={styles.availableBadge}>
                  <View style={styles.availableDot} />
                  <Text style={[styles.availableLabel, { color: theme.primaryDeep }]}>Available today</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <View style={styles.nameGroup}>
                    <Text style={[styles.name, { color: theme.text }]}>{doctor.name}</Text>
                    <SymbolView name="checkmark.seal" size={15} tintColor={theme.primary} />
                  </View>
                  <View style={styles.ratingGroup}>
                    <SymbolView name="star.fill" size={13} tintColor={theme.primary} />
                    <Text style={[styles.ratingLabel, { color: theme.text }]}>{doctor.rating.toFixed(1)}</Text>
                  </View>
                </View>

                <View style={[styles.specialtyTag, { backgroundColor: theme.primaryPale }]}>
                  <Text style={[styles.specialtyLabel, { color: theme.primaryDeep }]}>{doctor.specialty}</Text>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <SymbolView name="graduationcap" size={14} tintColor={theme.primary} />
                    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{doctor.school}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <SymbolView name="briefcase" size={14} tintColor={theme.primary} />
                    <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
                      {doctor.yearsExperience} yrs exp
                    </Text>
                  </View>
                </View>

                <Text style={[styles.bio, { color: theme.textSecondary }]}>{doctor.bio}</Text>
              </View>
            </Animated.View>
          </GestureDetector>
        )}

        {doctor && (
          <View style={styles.swipeButtons}>
            <Pressable style={[styles.roundButton, styles.passButton]} onPress={() => dismiss(-1)}>
              <SymbolView name="xmark" size={19} weight="semibold" tintColor={theme.textTertiary} />
            </Pressable>
            <Pressable style={[styles.roundButton, styles.likeButton, { backgroundColor: theme.primary }]} onPress={() => dismiss(1)}>
              <SymbolView name="heart.fill" size={22} tintColor="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      {doctor && (
        <View style={styles.footer}>
          <PrimaryButton title={`Book ${doctor.name.split(' ').slice(-1)[0]}`} onPress={bookCurrent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', fontFamily: Fonts.sans },

  stack: { flex: 1, paddingHorizontal: 20, paddingTop: 14, alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 19, fontWeight: '700', fontFamily: Fonts.sans },
  emptySubtitle: { fontSize: 14, textAlign: 'center', fontFamily: Fonts.sans },

  backCard: {
    position: 'absolute',
    left: 34,
    right: 34,
    top: 30,
    height: 500,
    borderRadius: Radius.xl,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#B565E8',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  photo: { height: 260, alignItems: 'center', justifyContent: 'center' },
  photoInitials: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitialsText: { fontSize: 32, fontWeight: '600', color: '#fff', fontFamily: Fonts.sans },
  availableBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  availableLabel: { fontSize: 11.5, fontWeight: '600', fontFamily: Fonts.sans },

  cardBody: { padding: 18, gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 20, fontWeight: '700', fontFamily: Fonts.sans },
  ratingGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingLabel: { fontSize: 13.5, fontWeight: '600', fontFamily: Fonts.sans },
  specialtyTag: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 7 },
  specialtyLabel: { fontSize: 12.5, fontWeight: '600', fontFamily: Fonts.sans },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabel: { fontSize: 12.5, fontWeight: '500', fontFamily: Fonts.sans },
  bio: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.sans },

  swipeButtons: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 16 },
  roundButton: { alignItems: 'center', justifyContent: 'center' },
  passButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  likeButton: { width: 58, height: 58, borderRadius: 29, shadowColor: '#B565E8', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },

  footer: { paddingHorizontal: 20, paddingTop: 8 },
});
