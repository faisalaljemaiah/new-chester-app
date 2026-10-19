import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Sends people to the welcome screen, the patient screens or the staff screens. */
export default function Index() {
  const { user, isStaff, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  return <Redirect href={isStaff ? '/staff' : '/(tabs)'} />;
}
