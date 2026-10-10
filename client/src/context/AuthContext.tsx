import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getMe, login as apiLogin, logout as apiLogout } from '../api/auth';
import { listAliases } from '../api/ocr-training';
import { setAliasOverlay, clearAliasOverlay } from '../utils/gtin-map';

/**
 * Load the persisted OCR alias overlay (from the Training lab) into the matcher.
 * Best-effort and fire-and-forget: a failure just means scans use the built-in
 * matcher. This is the one async touchpoint — the parse path itself stays pure.
 */
function loadAliasOverlay() {
  listAliases()
    .then((aliases) => setAliasOverlay(aliases))
    .catch(() => {
      /* overlay stays empty — graceful degradation */
    });
}

interface AuthUser {
  userId: string;
  username: string;
  role: string;
  distributorId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((u) => {
          setUser(u);
          loadAliasOverlay();
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    const data = await apiLogin(username, password);
    setUser({
      userId: data.user.id,
      username: data.user.username,
      role: data.user.role,
      distributorId: data.user.distributorId ?? null,
    });
    loadAliasOverlay();
  }

  async function logout() {
    await apiLogout();
    setUser(null);
    clearAliasOverlay();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
