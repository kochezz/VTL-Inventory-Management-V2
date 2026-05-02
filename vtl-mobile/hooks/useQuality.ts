import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { QualitySummary } from '../services/api';

export function useQuality() {
  return useQuery<QualitySummary>({
    queryKey: ['quality'],
    queryFn: api.getQuality,
    refetchInterval: 120_000,
  });
}
