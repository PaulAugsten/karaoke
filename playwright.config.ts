import { defineConfig, devices } from '@playwright/test';

const rawBaseURL = process.env.BASE_URL?.trim();
const baseURL = rawBaseURL
    ? /^https?:\/\//.test(rawBaseURL)
        ? rawBaseURL
        : `https://${rawBaseURL}`
    : 'http://localhost:3000';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html']] : 'html',
    // Only spin up a local server when there's no BASE_URL to target
    // (i.e. not running against a deployed preview/production URL).
    ...(rawBaseURL
        ? {}
        : {
              webServer: {
                  command: 'pnpm build && pnpm start',
                  url: baseURL,
                  reuseExistingServer: !process.env.CI,
                  timeout: 180_000,
              },
          }),
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        // Lets Playwright through Vercel's Deployment Protection on preview URLs.
        // See: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
            ? {
                  extraHTTPHeaders: {
                      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
                  },
              }
            : {}),
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
        { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
    ],
});
