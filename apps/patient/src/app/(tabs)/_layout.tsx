import { colors } from '@chester/shared';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { Icon, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const tabs = [
  { name: 'index', title: 'Home', ios: 'house.fill', material: 'home' },
  { name: 'appointments', title: 'Appointments', ios: 'calendar', material: 'calendar_month' },
  { name: 'messages', title: 'Messages', ios: 'bubble.left.and.bubble.right.fill', material: 'chat' },
  { name: 'profile', title: 'Profile', ios: 'person.fill', material: 'person' },
] as const;

export default function TabsLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}>
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
