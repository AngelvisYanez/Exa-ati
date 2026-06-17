"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  sriClient,
  getSession,
  clearSession,
  setSession,
  type SessionUser,
} from "@/lib/sriClient";

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  hasSriLinked: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nombre?: string) => Promise<void>;
  logout: () => void;
  refreshSriStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasSriLinked, setHasSriLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkSriLinked = useCallback(async () => {
    if (!sriClient.isAuthenticated()) {
      setHasSriLinked(false);
      return;
    }
    try {
      const res = await sriClient.getEmisor();
      setHasSriLinked(res.success && !!res.emisor);
    } catch {
      setHasSriLinked(false);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      checkSriLinked().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [checkSriLinked]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await sriClient.login(email.trim(), password);
      setUser(data.user);
      const redirect =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect") || "/"
          : "/";
      // Recarga completa para que el proxy reciba la cookie de sesión
      window.location.href = redirect;
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, nombre?: string) => {
      await sriClient.register(email, password, "USER", nombre);
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setHasSriLinked(false);
    if (!pathname?.startsWith("/login") && !pathname?.startsWith("/register")) {
      router.push("/login");
    }
  }, [router, pathname]);

  const refreshSriStatus = useCallback(async () => {
    await checkSriLinked();
  }, [checkSriLinked]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && sriClient.isAuthenticated(),
        hasSriLinked,
        isLoading,
        login,
        register,
        logout,
        refreshSriStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
