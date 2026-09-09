import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/performance',
  workers: 1,
  timeout: 420_000,
  expect: { timeout: 30_000 },
  outputDir: '.local-checks/pilot/results',
  reporter: [['list'], ['json', { outputFile: '.local-checks/pilot/report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4180', serviceWorkers: 'block' },
  projects: [
    { name: 'pilot-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pilot-mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    command:
      'npx vite build --config vite.performance.config.ts && npx vite preview --config vite.performance.config.ts --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
  },
});
