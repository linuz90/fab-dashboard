import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DASHBOARD_QUERY_KEY, dashboardRefetchInterval, fetchDashboard, hasRefreshingSources } from "./dashboardApi";

export function useDashboard() {
  const [showRefreshMotion, setShowRefreshMotion] = useState(false);
  const connectorRefreshStartedAt = useRef<number | null>(null);
  const refreshMotionTimeout = useRef<number | null>(null);
  const { data, dataUpdatedAt, error } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboard,
    refetchInterval: (q) => dashboardRefetchInterval(q.state.data),
    refetchOnMount: "always",
    staleTime: 0,
  });

  const fetchError = error instanceof Error ? error.message : error ? String(error) : null;
  const isRefreshingSources = !fetchError && hasRefreshingSources(data);

  useEffect(() => {
    if (refreshMotionTimeout.current) {
      window.clearTimeout(refreshMotionTimeout.current);
      refreshMotionTimeout.current = null;
    }

    if (isRefreshingSources) {
      const now = Date.now();
      connectorRefreshStartedAt.current ??= now;
      setShowRefreshMotion(true);
      return;
    }
    if (connectorRefreshStartedAt.current === null) return;
    const startedAt = connectorRefreshStartedAt.current;
    connectorRefreshStartedAt.current = null;
    const elapsed = Date.now() - startedAt;
    const holdMs = Math.max(180, 500 - elapsed);
    refreshMotionTimeout.current = window.setTimeout(() => {
      setShowRefreshMotion(false);
      refreshMotionTimeout.current = null;
    }, holdMs);

    return () => {
      if (refreshMotionTimeout.current) {
        window.clearTimeout(refreshMotionTimeout.current);
        refreshMotionTimeout.current = null;
      }
    };
  }, [isRefreshingSources]);

  return {
    resp: data ?? null,
    fetchError,
    fetchedAt: dataUpdatedAt || null,
    showRefreshMotion,
  };
}

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
