import { defineConfig, devices } from '@playwright/test';
// The site is a static export: build writes out/, and a plain static server (no Next server code) serves it.
// PW_PORT: run beside the owner's live preview on 3100 without touching it.
const port = Number(process.env.PW_PORT || 3100);
export default defineConfig({
  testDir: 'tests',
  testMatch: /(e2e|perf)\/.*\.spec\.ts$/, // perf/: whole-site frame budgets (@perf, real GPU)
  webServer: { command: `npm run build && node scripts/serve-out.mjs ${port}`, port, reuseExistingServer: !!process.env.PW_REUSE_SERVER, timeout: 180_000 },
  use: { baseURL: `http://localhost:${port}` },
  // parity compares against the prototype in .superpowers/brainstorm/.../home-v5.html, a git-ignored folder: it cannot run on a fresh clone or CI.
  // It depends on the other projects so it runs alone and last (the prototype blob animation is per-frame and skews under CPU load);
  // side effect: if any other project fails, parity is reported as "did not run".
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } }, grepInvert: /@nowebgl|@phone|@parity|@perf/ },
    // frame-time budgets: the machine's real GPU (new headless), not SwiftShader, which draws WebGL on the CPU and is far slower than any real low-end PC
    { name: 'perf', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, channel: 'chromium', launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] } }, grep: /@perf/ },
    { name: 'no-webgl', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } }, grep: /@nowebgl/ },
    { name: 'parity', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } }, grep: /@parity/, dependencies: ['desktop', 'no-webgl', 'phone'] },  // runs alone, after the rest: the prototype's blob animation is per-frame, so CPU contention would skew it
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
});
