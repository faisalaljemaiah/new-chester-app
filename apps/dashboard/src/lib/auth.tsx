"use client";

import type { Practitioner, Role } from "@chester/shared";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { auth, db } from "./firebase";

interface StaffAuth {
  user: User | null;
  role: Role | null;
  isAdmin: boolean;
  profile: (Practitioner & { id: string }) | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<StaffAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<StaffAuth["profile"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        // The role lives in a custom claim set by Cloud Functions; security rules trust the same claim.
        const token = u ? await u.getIdTokenResult() : null;
        setRole((token?.claims.role as Role | undefined) ?? null);
        if (!u) setProfile(null);
        setLoading(false);
      }),
    [],
  );

  useEffect(() => {
    if (!user || (role !== "practitioner" && role !== "admin")) return;
    return onSnapshot(doc(db, "practitioners", user.uid), (snap) =>
      setProfile(snap.exists() ? { id: snap.id, ...(snap.data() as Practitioner) } : null),
    );
  }, [user, role]);

  return (
    <AuthContext.Provider
      value={{ user, role, isAdmin: role === "admin", profile, loading, signOut: () => signOut(auth) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
