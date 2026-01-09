import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api/client';
import type { Dashboard } from '@/types';
import { toast } from 'sonner';

interface UseDashboardResult {
  dashboard: Dashboard | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(
  token: string | null,
  options?: { enabled?: boolean }
): UseDashboardResult {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabled = options?.enabled ?? true;

  const fetchDashboard = useCallback(async () => {
    if (!enabled) {
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.get(token);
      setDashboard(data);
    } catch (err) {
      setError('Failed to load dashboard');
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [enabled, token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: fetchDashboard,
  };
}
