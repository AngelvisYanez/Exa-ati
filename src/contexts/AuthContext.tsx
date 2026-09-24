"use client";

import {
  createContext,
  useCallback,
  use,
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
  activeRuc: string | null;
  rucList: { ruc: string; razonSocial: string }[];
  setActiveRuc: (ruc: string) => void;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (email: string, password: string, nombre?: string) => Promise<void>;
  logout: () => void;
  refreshSriStatus: () => Promise<void>;
  refreshUserModules: () => Promise<void>;
  hasModule: (codigo: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasSriLinked, setHasSriLinked] = useState(false);
  const [rucList, setRucList] = useState<{ ruc: string; razonSocial: string }[]>([]);
  const [activeRuc, setActiveRucState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSriLinked = useCallback(async (currentUser: SessionUser | null) => {
    if (!sriClient.isAuthenticated() || !currentUser) {
      setHasSriLinked(false);
      setRucList([]);
      setActiveRucState(null);
      return;
    }
    try {
      if (currentUser.rol === "USER") {
        const res = await sriClient.getEmisor();
        if (res.success && res.emisor) {
          const item = { ruc: res.emisor.ruc, razonSocial: res.emisor.razonSocial || res.emisor.ruc };
          setRucList([item]);
          setHasSriLinked(true);
          setActiveRucState(res.emisor.ruc);
          localStorage.setItem("sri_selected_ruc", res.emisor.ruc);
        } else {
          setRucList([]);
          setHasSriLinked(false);
          setActiveRucState(null);
        }
      } else {
        const res = await sriClient.getEmisores();
        if (res.success && res.emisores && res.emisores.length > 0) {
          const list = res.emisores.map((e: any) => ({
            ruc: e.ruc,
            razonSocial: e.razonSocial || `Contribuyente ${e.ruc}`,
          }));
          setRucList(list);
          setHasSriLinked(true);

          const stored = localStorage.getItem("sri_selected_ruc");
          if (stored && list.some((x: any) => x.ruc === stored)) {
            setActiveRucState(stored);
          } else {
            setActiveRucState(list[0].ruc);
            localStorage.setItem("sri_selected_ruc", list[0].ruc);
          }
        } else {
          setRucList([]);
          setHasSriLinked(false);
          setActiveRucState(null);
        }
      }
    } catch {
      setRucList([]);
      setHasSriLinked(false);
      setActiveRucState(null);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      checkSriLinked(session.user).finally(() => setIsLoading(false));
      // Refrescar módulos desde /api/auth/me (por si cambiaron en admin)
      void (async () => {
        try {
          const token = typeof window !== "undefined"
            ? localStorage.getItem("sri_access_token")
            : null;
          if (!token) return;
          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data.user) {
            const updated: SessionUser = {
              ...session.user,
              ...data.user,
              modulos: data.user.modulos || [],
            };
            setSession({
              accessToken: token,
              user: updated,
            });
            setUser(updated);
          }
        } catch {
          /* ignore */
        }
      })();
    } else {
      setIsLoading(false);
    }
  }, [checkSriLinked]);

  const refreshUserModules = useCallback(async () => {
    const session = getSession();
    if (!session?.user) return;
    try {
      const token = localStorage.getItem("sri_access_token");
      if (!token) return;
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        const updated: SessionUser = {
          ...session.user,
          ...data.user,
          modulos: data.user.modulos || [],
        };
        setSession({ accessToken: token, user: updated });
        setUser(updated);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const hasModule = useCallback(
    (codigo: string) => {
      if (!user) return false;
      if (user.rol === "SUPERADMIN") return true;
      if (user.modulos?.includes(codigo)) return true;
      return false;
    },
    [user]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await sriClient.login(email.trim(), password);
      setUser(data.user);
      await checkSriLinked(data.user);
      return data.user;
    },
    [checkSriLinked]
  );

  const register = useCallback(
    async (email: string, password: string, nombre?: string) => {
      await sriClient.register(email, password, "USER", nombre);
      await login(email, password);
      window.location.href = "/";
    },
    [login]
  );

  const logout = useCallback(() => {
    clearSession();
    localStorage.removeItem("sri_selected_ruc");
    setUser(null);
    setHasSriLinked(false);
    setRucList([]);
    setActiveRucState(null);
    if (!pathname?.startsWith("/login") && !pathname?.startsWith("/register")) {
      router.push("/login");
    }
  }, [router, pathname]);

  const refreshSriStatus = useCallback(async () => {
    const session = getSession();
    await checkSriLinked(session?.user ?? null);
  }, [checkSriLinked]);

  const setActiveRuc = useCallback((ruc: string) => {
    localStorage.setItem("sri_selected_ruc", ruc);
    setActiveRucState(ruc);
    window.location.reload();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && sriClient.isAuthenticated(),
        hasSriLinked,
        isLoading,
        activeRuc,
        rucList,
        setActiveRuc,
        login,
        register,
        logout,
        refreshSriStatus,
        refreshUserModules,
        hasModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
