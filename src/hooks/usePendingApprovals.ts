import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  api, 
  onSessionRequestCreated, 
  onSessionStatusUpdated, 
  onSessionsUpdated 
} from '../lib/api';

export function usePendingApprovals() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingSessions, setPendingSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const currentUser = useAppStore(state => state.currentUser);

  const fetchPending = useCallback(async () => {
    if (!currentUser?.id) {
      setPendingCount(0);
      setPendingSessions([]);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.getPendingApprovalCount();
      setPendingCount(res.count ?? 0);
      setPendingSessions(res.sessions ?? []);
    } catch (err) {
      console.warn('[usePendingApprovals] fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchPending();

    // 1. Refresh every 30 seconds over REST
    const interval = setInterval(() => {
      fetchPending();
    }, 30000);

    // 2. Refresh on window focus and visibility change
    const onFocus = () => {
      fetchPending();
    };
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchPending();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 3. Refresh on live socket updates as well
    const unsubReq = onSessionRequestCreated(() => {
      fetchPending();
    });
    const unsubStatus = onSessionStatusUpdated(() => {
      fetchPending();
    });
    const unsubSessions = onSessionsUpdated(() => {
      fetchPending();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubReq();
      unsubStatus();
      unsubSessions();
    };
  }, [fetchPending]);

  return {
    pendingCount,
    pendingSessions,
    isLoading,
    refresh: fetchPending
  };
}
