import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Patient, Practitioner, Profile, Role } from '@chester/shared';

import { useLive } from './hooks';
import { supabase } from './supabase';

interface AuthState {
  user: User | null;
  role: Role | null;
  /** Practitioners and admins see the staff screens; everyone else the patient screens. */
  isStaff: boolean;
  isAdmin: boolean;
  /** The patient file, for patients. */
  patient: Patient | null;
  /** The practitioner profile, for staff. */
  practitioner: Practitioner | null;
  /** True until the first auth state (and the account's role) has loaded. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  isStaff: false,
  isAdmin: false,
  patient: null,
  practitioner: null,
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
  // The role lives in profiles; only database functions can change it.
  const account = useLive<Profile>(
    uid,
    () => supabase.from('profiles').select('*').eq('id', uid!).maybeSingle(),
    ['profiles'],
  );
  const role = account.data?.role ?? null;
  const isStaff = role === 'practitioner' || role === 'admin';

  // The database creates the patient file when the account is created.
  const patient = useLive<Patient>(
    uid && role === 'patient' ? uid : null,
    () => supabase.from('patients').select('*').eq('id', uid!).maybeSingle(),
    ['patients'],
  );
  const practitioner = useLive<Practitioner>(
    uid && isStaff ? uid : null,
    () => supabase.from('practitioners').select('*').eq('id', uid!).maybeSingle(),
    ['practitioners'],
  );

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        role,
        isStaff,
        isAdmin: role === 'admin',
        patient: patient.data,
        practitioner: practitioner.data,
        // The role arrives just after the session, so wait for it (or its error) before routing.
        loading:
          !sessionLoaded ||
          (uid !== null && (account.loading || (!account.data && !account.error))) ||
          patient.loading ||
          practitioner.loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
