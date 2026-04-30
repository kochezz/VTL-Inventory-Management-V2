import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
    refetchInterval: 60_000,
  });
}

export function useAlerts(limit = 20) {
  return useQuery({
    queryKey: ['alerts', limit],
    queryFn: () => api.getAlerts(limit),
    refetchInterval: 30_000,
  });
}
