import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const checks = [
  { id: 'overview', path: '/?team=atlas', heading: 'Sprint trends' },
  { id: 'sprint', path: '/sprints/sprint-06?team=atlas', heading: 'Sprint goal' },
  { id: 'retrospective', path: '/retrospectives?team=atlas&sprint=sprint-06', heading: 'What went well' },
  { id: 'agenda', path: '/agenda?team=atlas&sprint=sprint-06', heading: 'Planning agenda' },
  { id: 'not-found', path: '/unknown?team=atlas', heading: 'Page unavailable' },
];

async function checkAxe(page: Page, id: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await mkdir('../reports/axe', { recursive: true });
  await writeFile(`../reports/axe/${id}.json`, JSON.stringify(result, null, 2));
  expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })))
    .toEqual([]);
}

for (const { id, path, heading } of checks) {
  test(`axe finds no WCAG A/AA violations on ${id}`, async ({ page }) => {
    if (id === 'overview') await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    if (id === 'retrospective') {
      await page.getByRole('button', { name: 'Summarize notes' }).click();
      await expect(page.getByRole('heading', { name: 'Suggested actions' })).toBeVisible();
    }
    if (id === 'sprint') await page.getByText('View burndown data').click();
    await checkAxe(page, id);
    if (id === 'overview') {
      await mkdir('../reports/screenshots', { recursive: true });
      await page.locator('.trend-panel').screenshot({
        path: '../reports/screenshots/overview-chart.png', animations: 'disabled',
      });
    }
  });
}

test('mobile sprint controls fit and the page passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('/sprints/sprint-06?team=atlas');
  await expect(page.getByRole('heading', { name: 'Sprint goal' })).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(sizes.document).toBe(sizes.viewport);
  await expect(page.getByRole('combobox', { name: 'Sprint', exact: true })).toBeInViewport({ ratio: 1 });
  await checkAxe(page, 'mobile-sprint');
  await mkdir('../reports/screenshots', { recursive: true });
  await page.screenshot({ path: '../reports/screenshots/mobile-sprint.png', animations: 'disabled' });
});
