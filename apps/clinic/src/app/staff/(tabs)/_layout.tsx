import { colors } from '@chester/shared';
import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { useMyResults, usePendingAvailabilityRequests, useTransfers } from '@/lib/staff-queries';

const tabs: { name: string; key: MessageKey; ios: string; material: string }[] = [
  { name: 'index', key: 'navOverview', ios: 'square.grid.2x2.fill', material: 'dashboard' },
  { name: 'appointments', key: 'navAppointments', ios: 'calendar', material: 'calendar_month' },
  { name: 'patients', key: 'navPatients', ios: 'person.2.fill', material: 'group' },
  { name: 'assessments', key: 'navAssessments', ios: 'list.clipboard', material: 'assignment' },
  { name: 'more', key: 'navMore', ios: 'ellipsis.circle', material: 'more_horiz' },
];

export default function StaffTabs() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const { data: results } = useMyResults(user?.id);
  const { data: incoming } = useTransfers(user?.id, 'to_practitioner_id');
  const { data: requests } = usePendingAvailabilityRequests(isAdmin);
  const badges: Record<string, number> = {
    assessments: results.filter((r) => !r.reviewed).length,
    more: incoming.filter((x) => x.status === 'pending').length + requests.length,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11 },
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.key),
            tabBarBadge: badges[tab.name] ? badges[tab.name] : undefined,
            tabBarIcon: ({ color }) => <Icon ios={tab.ios} material={tab.material} color={color} size={22} />,
          }}
        />
      ))}
    </Tabs>
  );
}
