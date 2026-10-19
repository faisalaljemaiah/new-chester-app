import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Patient } from '@chester/shared';

import { auth, db } from './firebase';

interface AuthState {
  user: User | null;
  patient: (Patient & { id: string }) | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [patient, setPatient] = useState<AuthState['patient']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) {
      setPatient(null);
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    // The patient file is created by the registerPatient function right after sign-up,
    // so it may not exist for the first moment.
    return onSnapshot(
      doc(db, 'patients', user.uid),
      (snap) => {
        setPatient(snap.exists() ? { id: snap.id, ...(snap.data() as Patient) } : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, patient, loading, signOut: () => signOut(auth) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
