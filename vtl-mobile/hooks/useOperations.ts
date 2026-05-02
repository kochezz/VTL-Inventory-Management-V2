import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { OperationsSummary } from '../services/api';

export function useOperations() {
  return useQuery<OperationsSummary>({
    queryKey: ['operations'],
    queryFn: api.getOperations,
    refetchInterval: 90_000,
  });
}
