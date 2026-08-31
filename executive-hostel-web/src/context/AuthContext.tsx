import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { api, getStoredAuth, storeAuth, clearAuth } from "../lib/api";

interface AuthState {
  isAuthenticated: boolean;
  role: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string | null>(() => getStoredAuth().role);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.login(identifier, password);
    storeAuth(result.accessToken, result.refreshToken, result.role);
    setRole(result.role);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    clearAuth();
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!role, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
