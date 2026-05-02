import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { PeopleSummary } from '../services/api';

export function usePeople() {
  return useQuery<PeopleSummary>({
    queryKey: ['people'],
    queryFn: api.getPeople,
    refetchInterval: 300_000,
  });
}
