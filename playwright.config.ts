import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile-chromium',
      testIgnore: ['**/recovery.spec.ts', '**/*.cloud.spec.ts'],
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
    {
      name: 'desktop-chromium',
      testIgnore: ['**/recovery.spec.ts', '**/*.cloud.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-auth',
      testMatch: ['**/recovery.spec.ts', '**/*.cloud.spec.ts'],
      use: { ...devices['Pixel 7'], browserName: 'chromium', baseURL: 'http://127.0.0.1:4179' },
    },
    {
      name: 'desktop-auth',
      testMatch: ['**/recovery.spec.ts', '**/*.cloud.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4179' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 4178 --strictPort',
      url: 'http://127.0.0.1:4178',
      env: { VITE_DATA_BACKEND: 'local' },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 4179 --strictPort',
      url: 'http://127.0.0.1:4179',
      env: {
        VITE_DATA_BACKEND: 'supabase',
        VITE_SUPABASE_URL: 'https://auth-test.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture',
      },
      reuseExistingServer: false,
    },
  ],
});
