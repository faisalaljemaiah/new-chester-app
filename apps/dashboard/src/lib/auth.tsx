"use client";

import type { Practitioner, Profile, Role } from "@chester/shared";
import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useLive } from "./hooks";
import { supabase } from "./supabase";

interface StaffAuth {
  user: User | null;
  role: Role | null;
  isAdmin: boolean;
  profile: Practitioner | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<StaffAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = user?.id ?? null;
  // The role lives in the profiles table; only database functions can change it.
  const account = useLive<Profile>(
    uid,
    () => supabase.from("profiles").select("*").eq("id", uid!).maybeSingle(),
    ["profiles"],
  );
  const role = account.data?.role ?? null;
  const isStaff = role === "practitioner" || role === "admin";
  const practitioner = useLive<Practitioner>(
    isStaff ? uid : null,
    () => supabase.from("practitioners").select("*").eq("id", uid!).maybeSingle(),
    ["practitioners"],
  );

  const loading = !sessionLoaded || account.loading || practitioner.loading;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin: role === "admin",
        profile: practitioner.data,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
