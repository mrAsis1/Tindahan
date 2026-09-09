import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Never load .env.local or build into the deployable dist directory.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: false,
  define: {
    'import.meta.env.VITE_DATA_BACKEND': JSON.stringify('supabase'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://pilot-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_fixture'),
  },
  build: { outDir: '.local-checks/pilot/app' },
});
