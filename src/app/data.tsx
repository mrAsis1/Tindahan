import { createContext, useContext, useEffect } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLocalRepository, STORAGE_KEY } from '../lib/api/localRepository';
import type { StoreData } from '../types';
import { backendMode, supabaseRepository, readCloudNotebook } from '../lib/api/supabase';
import { projectNotebook, type NotebookView, type ReadTotals } from '../lib/notebookReads';
import type { Repository } from '../lib/api/repository';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15_000 } },
});
// Access storage lazily so a disabled-storage error can be displayed in the UI.
export const localRepository = createLocalRepository({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});
export const repository: Repository =
  backendMode === 'supabase' ? supabaseRepository : localRepository;
export const DataContext = createContext<StoreData | null>(null);
export const ReadTotalsContext = createContext<ReadTotals | null>(null);
export const useReadTotals = () => useContext(ReadTotalsContext);
export function useData() {
  const data = useContext(DataContext);
  if (!data) throw new Error('Store data is not loaded.');
  return data;
}
export const readNotebook = async (view: NotebookView) =>
  backendMode === 'supabase'
    ? readCloudNotebook(view)
    : projectNotebook(await localRepository.getData(), view);

export function useStoreQuery(ownerId = 'local', view: NotebookView = { kind: 'full' }) {
  const client = useQueryClient();
  useEffect(() => {
    if (backendMode !== 'local') return;
    const update = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null)
        void client.invalidateQueries({ queryKey: ['store'] });
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [client]);
  return useQuery({
    queryKey: ['store', ownerId, view],
    queryFn: () => readNotebook(view),
  });
}
export const refreshData = () => queryClient.invalidateQueries({ queryKey: ['store'] });
