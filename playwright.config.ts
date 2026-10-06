import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served like the static host (scripts/serve.ts).
// Build first: `npm run build && npm run build:fixture && npm run test:e2e`.

const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', launchOptions: { args: gl } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: gl } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { args: gl } } },
  ],
  webServer: [
    { command: 'tsx scripts/serve.ts', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
    // Fixture catalog (tests/fixtures/catalog) with finish variants: `npm run build:fixture`.
    { command: 'tsx scripts/serve.ts', url: 'http://localhost:4174', env: { PORT: '4174', DIST: 'dist-fixture' }, reuseExistingServer: !process.env.CI },
  ],
});
