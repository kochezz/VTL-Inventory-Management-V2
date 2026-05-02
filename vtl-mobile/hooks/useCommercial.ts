import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { CommercialSummary } from '../services/api';

export function useCommercial() {
  return useQuery<CommercialSummary>({
    queryKey: ['commercial'],
    queryFn: api.getCommercial,
    refetchInterval: 120_000,
  });
}
