import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Patient } from '@chester/shared';

import { useLive } from './hooks';
import { supabase } from './supabase';

interface AuthState {
  user: User | null;
  patient: Patient | null;
  /** True until the first auth state (and patient file, if signed in) has loaded. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  patient: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id ?? null;
  // The database creates the patient file when the account is created.
  const patient = useLive<Patient>(
    uid,
    () => supabase.from('patients').select('*').eq('id', uid!).maybeSingle(),
    ['patients'],
  );

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        patient: patient.data,
        loading: !sessionLoaded || patient.loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
