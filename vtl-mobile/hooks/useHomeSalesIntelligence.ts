import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { HomeSalesIntelligence, HomeSalesRange } from '../services/api';

export function useHomeSalesIntelligence(range: HomeSalesRange = '30d') {
  return useQuery<HomeSalesIntelligence>({
    queryKey: ['home-sales-intelligence', range],
    queryFn: () => api.getHomeSalesIntelligence(range),
    refetchInterval: 120_000,
  });
}
