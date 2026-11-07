import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import type { Role, User } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: unknown;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await api.auth.login({ email, password });
      queryClient.setQueryData(['me'], user);
      return user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const user = await api.auth.register({ name, email, password });
      queryClient.setQueryData(['me'], user);
      return user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ queryKey: ['notifications'] });
      queryClient.removeQueries({ queryKey: ['reports'] });
    }
  }, [queryClient]);

  const refresh = useCallback(() => meQuery.refetch(), [meQuery]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      error: meQuery.error,
      login,
      register,
      logout,
      refresh,
    }),
    [login, logout, meQuery.data, meQuery.error, meQuery.isLoading, refresh, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return Boolean(user?.permissions.includes(permission));
}

export function hasRole(user: User | null, ...roles: Role[]): boolean {
  return Boolean(user && roles.includes(user.role));
}
