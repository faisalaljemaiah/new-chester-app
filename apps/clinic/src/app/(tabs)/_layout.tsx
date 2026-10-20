import { colors, radius, spacing } from '@chester/shared';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion';
import { Icon, Loading, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const tabs = [
  { name: 'index', title: 'Home', ios: 'house.fill', material: 'home' },
  { name: 'appointments', title: 'Appointments', ios: 'calendar', material: 'calendar_month' },
  { name: 'messages', title: 'Messages', ios: 'bubble.left.and.bubble.right.fill', material: 'chat' },
  { name: 'profile', title: 'Profile', ios: 'person.fill', material: 'person' },
] as const;

export default function TabsLayout() {
  const { user, isStaff, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  if (isStaff) return <Redirect href="/staff" />;

  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Icon ios={t.ios} material={t.material} color={color} size={22} />,
          }}
        />
      ))}
    </Tabs>
  );
}

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Floating pill bar, after fai's reference: the current tab shows its name in a purple pill, the others are icons. */
function FloatingTabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = tabs.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: focused }}
              onPress={() => !focused && navigateToTab(route.key)}
              style={[styles.item, focused && styles.itemActive]}>
              <Icon ios={tab.ios} material={tab.material} color={focused ? colors.onPrimary : colors.textMuted} size={22} />
              {focused && (
                <Animated.View entering={FadeIn.duration(220)}>
                  <Text style={styles.label}>{tab.title}</Text>
                </Animated.View>
              )}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#3B2A80',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: { height: 52, minWidth: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  itemActive: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg },
  label: { fontSize: 15, fontWeight: '600', color: colors.onPrimary },
});
