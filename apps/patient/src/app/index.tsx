import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Sends people to the welcome screen or the app depending on whether they are signed in. */
export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Redirect href={user ? '/(tabs)' : '/welcome'} />;
}
