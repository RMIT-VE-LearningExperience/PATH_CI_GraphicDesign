"use client";

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { initializeFirebaseClient, getAuthInstance } from "../lib/firebase-client";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

interface User {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const auth = initializeFirebaseClient();

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });

          // Get role from localStorage (set during login)
          const storedRole = window.localStorage.getItem("adminRole");
          setRole(storedRole || null);
        } else {
          setUser(null);
          setRole(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Auth initialization error:", err);
      setLoading(false);
    }
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem("adminRole");
    window.localStorage.removeItem("adminLoginTime");
  }, []);

  // Enforce 8-hour hard session limit
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const loginTime = window.localStorage.getItem("adminLoginTime");
      if (!loginTime) return;

      const elapsed = Date.now() - parseInt(loginTime, 10);
      if (elapsed >= SESSION_DURATION_MS) {
        clearSession();
        const auth = getAuthInstance();
        void fetch("/api/logout", { method: "POST" }).finally(() => {
          void firebaseSignOut(auth).finally(() => {
            router.push("/login");
          });
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, clearSession, router]);

  const handleSignOut = async () => {
    try {
      const auth = getAuthInstance();
      await firebaseSignOut(auth);
      clearSession();
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
