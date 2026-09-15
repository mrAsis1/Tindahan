// Use persistent browser storage explicitly. The SDK's default can silently
// fall back to memory when storage is blocked, losing the login on reopening.
export const authOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  storage: {
    getItem: (key: string) => window.localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        throw new Error(
          'This browser could not save your sign-in. Allow site storage and try again.',
        );
      }
    },
    removeItem: (key: string) => window.localStorage.removeItem(key),
  },
};
