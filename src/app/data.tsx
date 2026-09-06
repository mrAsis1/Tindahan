import { createContext, useContext, useEffect } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLocalRepository, STORAGE_KEY } from '../lib/api/localRepository';
import type { StoreData } from '../types';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15_000 } },
});
// Access storage lazily so a disabled-storage error can be displayed in the UI.
export const repository = createLocalRepository({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});
export const DataContext = createContext<StoreData | null>(null);
export function useData() {
  const data = useContext(DataContext);
  if (!data) throw new Error('Store data is not loaded.');
  return data;
}
export function useStoreQuery() {
  const client = useQueryClient();
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        void client.invalidateQueries({ queryKey: ['store'] });
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [client]);
  return useQuery({ queryKey: ['store'], queryFn: () => repository.getData() });
}
export const refreshData = () => queryClient.invalidateQueries({ queryKey: ['store'] });
