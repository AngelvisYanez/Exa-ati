"use client";

import {
  createContext,
  useCallback,
  use,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
  switchEmpresa: (tenantId: string) => Promise<void>;
  createEmpresa: (nombre: string, ruc?: string | null) => Promise<string>;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (email: string, password: string, nombre?: string) => Promise<void>;
  logout: () => void;
  refreshSriStatus: () => Promise<void>;
  refreshUserModules: () => Promise<void>;
  hasModule: (codigo: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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
      // Opción 2: 1 RUC por empresa (tenant). Preferir getEmisor.
      const res = await sriClient.getEmisor();
      if (res.success && res.emisor) {
        const item = {
          ruc: res.emisor.ruc,
          razonSocial: res.emisor.razonSocial || res.emisor.ruc,
        };
        setRucList([item]);
        setHasSriLinked(true);
        setActiveRucState(res.emisor.ruc);
        localStorage.setItem("sri_selected_ruc", res.emisor.ruc);
        return;
      }

      // Fallback listado (legacy multi-emisor en un tenant)
      if (currentUser.rol !== "USER") {
        const listRes = await sriClient.getEmisores();
        if (listRes.success && listRes.emisores && listRes.emisores.length > 0) {
          const list = listRes.emisores.map((e: { ruc: string; razonSocial?: string }) => ({
            ruc: e.ruc,
            razonSocial: e.razonSocial || `Contribuyente ${e.ruc}`,
          }));
          setRucList(list);
          setHasSriLinked(true);
          const stored = localStorage.getItem("sri_selected_ruc");
          if (stored && list.some((x: { ruc: string }) => x.ruc === stored)) {
            setActiveRucState(stored);
          } else {
            setActiveRucState(list[0].ruc);
            localStorage.setItem("sri_selected_ruc", list[0].ruc);
          }
          return;
        }
      }

      setRucList([]);
      setHasSriLinked(false);
      setActiveRucState(null);
      localStorage.removeItem("sri_selected_ruc");
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
      void (async () => {
        try {
          const token =
            typeof window !== "undefined"
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
            setSession({ accessToken: token, user: updated });
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
      window.location.href = "/registro";
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
    window.location.href = "/";
  }, []);

  const refreshSriStatus = useCallback(async () => {
    const session = getSession();
    await checkSriLinked(session?.user ?? null);
  }, [checkSriLinked]);

  const setActiveRuc = useCallback((ruc: string) => {
    localStorage.setItem("sri_selected_ruc", ruc);
    setActiveRucState(ruc);
    window.location.reload();
  }, []);

  /** Cambia de empresa (tenant): nuevo JWT y recarga con datos aislados. */
  const switchEmpresa = useCallback(async (tenantId: string) => {
    localStorage.removeItem("sri_selected_ruc");
    const data = await sriClient.switchEmpresa(tenantId);
    if (data.user) setUser(data.user);
    window.location.href = "/panel";
  }, []);

  /** Crea empresa bajo la cuenta y cambia a ella. */
  const createEmpresa = useCallback(async (nombre: string, ruc?: string | null) => {
    const res = await sriClient.createEmpresa(nombre, ruc);
    const tenantId = res.data?.tenantId as string | undefined;
    if (!tenantId) throw new Error("No se pudo crear la empresa");
    await sriClient.switchEmpresa(tenantId);
    localStorage.removeItem("sri_selected_ruc");
    window.location.href = "/configuracion";
    return tenantId;
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
        switchEmpresa,
        createEmpresa,
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
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
