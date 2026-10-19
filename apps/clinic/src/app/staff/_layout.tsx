import { colors } from '@chester/shared';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

/** Staff area: practitioners and admins only, in English or Arabic (right to left). */
export default function StaffLayout() {
  const { user, isStaff, loading } = useAuth();
  const { dir } = useI18n();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  if (!isStaff) return <Redirect href="/(tabs)" />;

  return (
    <View style={{ flex: 1, direction: dir, backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </View>
  );
}
