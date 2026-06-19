import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getExpiring } from '../api/reports';
import { useAuth } from './AuthContext';
import type { ExpiringItem } from '../types';

const STORAGE_KEY = 'dismissed_notifications';

interface NotificationContextValue {
  notifications: ExpiringItem[];
  unread: ExpiringItem[];
  unreadCount: number;
  dismissNotification: (udi: string) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function loadDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveDismissed(udis: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(udis));
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const { user } = useAuth();

  const { data: expiring = [] } = useQuery({
    queryKey: ['notifications', 'expiring'],
    queryFn: () => getExpiring(90),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    // Expiry alerts come from company-wide reports, which distributor accounts
    // can't access; skip the query for them.
    enabled: user?.role !== 'distributor',
  });

  // Prune dismissed UDIs that are no longer in the expiring list
  useEffect(() => {
    const activeUdis = new Set(expiring.map((i) => i.udi));
    const pruned = dismissed.filter((udi) => activeUdis.has(udi));
    if (pruned.length !== dismissed.length) {
      setDismissed(pruned);
      saveDismissed(pruned);
    }
  }, [expiring]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissNotification = useCallback((udi: string) => {
    setDismissed((prev) => {
      const next = prev.includes(udi) ? prev : [...prev, udi];
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    const allUdis = expiring.map((i) => i.udi);
    setDismissed(allUdis);
    saveDismissed(allUdis);
  }, [expiring]);

  const unread = expiring.filter((i) => !dismissed.includes(i.udi));
  const unreadCount = unread.length;

  return (
    <NotificationContext.Provider value={{ notifications: expiring, unread, unreadCount, dismissNotification, dismissAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
