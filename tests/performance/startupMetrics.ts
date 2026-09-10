import type { BrowserContext, Page } from '@playwright/test';

type HomeMetrics = {
  homeContentMs: number | null;
  homePaintOpportunityMs: number | null;
  longTasks: { startMs: number; durationMs: number }[];
  longTasksSupported: boolean;
};

type MetricsWindow = Window & { pilotStartup: HomeMetrics };

// Test-only observations: do not wrap application functions or change auth timing.
export async function observeHomeStartup(context: BrowserContext) {
  await context.addInitScript(() => {
    const metrics: HomeMetrics = {
      homeContentMs: null,
      homePaintOpportunityMs: null,
      longTasks: [],
      longTasksSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'),
    };
    (window as unknown as MetricsWindow).pilotStartup = metrics;
    if (metrics.longTasksSupported) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          metrics.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    }
    const observer = new MutationObserver(() => {
      // The pilot's reconciled Home result, not the earlier loading/status paint.
      if (
        document.querySelector('.hero .amount')?.textContent !== '₱1,000,000.00' ||
        !document.querySelector('.hero')?.textContent?.includes('500 customers with a balance')
      )
        return;
      metrics.homeContentMs = performance.now();
      observer.disconnect();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          metrics.homePaintOpportunityMs = performance.now();
        });
      });
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
  });
}

export async function readHomeStartup(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as MetricsWindow).pilotStartup.homePaintOpportunityMs !== null,
  );
  return page.evaluate(() => {
    const metrics = (window as unknown as MetricsWindow).pilotStartup;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const scripts = resources.filter((r) => new URL(r.name).pathname.endsWith('.js'));
    const notebook = resources.find(
      (r) => new URL(r.name).pathname === '/rest/v1/rpc/read_notebook',
    );
    const firstPaint = performance.getEntriesByName('first-contentful-paint')[0];
    const ready = metrics.homePaintOpportunityMs!;
    const scriptEnd = Math.max(0, ...scripts.map((r) => r.responseEnd));
    return {
      domInteractiveMs: Math.round(navigation.domInteractive),
      firstContentfulPaintMs: firstPaint ? Math.round(firstPaint.startTime) : null,
      homeContentMs: Math.round(metrics.homeContentMs!),
      homePaintOpportunityMs: Math.round(ready),
      scriptEndToHomeMs: Math.round(ready - scriptEnd),
      notebookRequestMs: notebook ? Math.round(notebook.startTime) : null,
      notebookResponseEndMs: notebook ? Math.round(notebook.responseEnd) : null,
      notebookResponseToHomeMs: notebook ? Math.round(ready - notebook.responseEnd) : null,
      longTasksSupported: metrics.longTasksSupported,
      longTasks: metrics.longTasks
        .filter((t) => t.startMs < ready)
        .map((t) => ({
          startMs: Math.round(t.startMs),
          durationMs: Math.round(t.durationMs),
        })),
      scripts: scripts.map((r) => ({
        path: new URL(r.name).pathname,
        decodedBytes: r.decodedBodySize,
        endMs: Math.round(r.responseEnd),
      })),
      scriptBytes: scripts.reduce((sum, r) => sum + r.decodedBodySize, 0),
    };
  });
}
