import { expect, test } from '@playwright/test';

test('loads three synthetic teams and twelve sprints in the overview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Team' }).locator('option')).toHaveText(['Atlas', 'Beacon', 'Cedar']);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(13);
  await expect(page.getByText('Synthetic workspace')).toBeVisible();
});

test('switches team and keeps the selection when opening another page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Team', exact: true }).selectOption('cedar');
  await expect(page.getByText('Cedar / Internal operations')).toBeVisible();
  await page.getByRole('link', { name: 'Retrospectives' }).click();
  await expect(page.getByRole('combobox', { name: 'Team', exact: true })).toHaveValue('cedar');
  await expect(page.getByText('Alex Rivera')).toBeVisible();
});

test('switches chart metric and opens the selected sprint from a bar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Metric', exact: true }).selectOption('throughput');
  await page.getByRole('link', { name: /Sprint 06.*Throughput/ }).click();
  await expect(page.getByRole('heading', { name: 'Sprint 06', exact: true })).toBeVisible();
  await expect(page.getByText('+15 points added during the sprint')).toBeVisible();
});

test('displays an accessible data table for the burndown', async ({ page }) => {
  await page.goto('/sprints/sprint-06?team=atlas');
  await page.getByText('View burndown data').click();
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader', { name: 'Actual points' })).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(16);
});

test('changes sprint and expands a carried issue with its timestamped history', async ({ page }) => {
  await page.goto('/sprints/sprint-06?team=atlas');
  await page.getByRole('combobox', { name: 'Sprint', exact: true }).selectOption('sprint-04');
  await expect(page.getByRole('heading', { name: 'Sprint 04', exact: true })).toBeVisible();
  const carried = page.locator('details.issue').filter({ hasText: 'Carried from sprint 03' });
  await carried.locator('summary').click();
  await expect(carried.getByText(/Carried from sprint 03/)).toBeVisible();
  await expect(carried.locator('time')).toHaveCount(3);
});

test('shows an empty issue state when a status matches no issues', async ({ page }) => {
  await page.goto('/sprints/sprint-06?team=atlas');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('To Do');
  await expect(page.getByText('No issues match this status.')).toBeVisible();
});

test('shows both kinds of notes and the action owners', async ({ page }) => {
  await page.goto('/retrospectives?team=atlas&sprint=sprint-06');
  await expect(page.getByRole('heading', { name: 'What went well' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What to improve' })).toBeVisible();
  await expect(page.getByText('Maya Chen')).toBeVisible();
  await expect(page.getByText(/Scope creep from three/)).toBeVisible();
});

test('summarizes feedback with evidence and existing actions', async ({ page }) => {
  await page.goto('/retrospectives?team=atlas&sprint=sprint-06');
  await page.getByRole('button', { name: 'Summarize notes' }).click();
  await expect(page.getByRole('status')).toHaveText('Summary ready. 3 themes found.');
  await expect(page.getByText('Scope changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested actions' })).toBeVisible();
  await expect(page.locator('.ai-panel').getByText('Maya Chen')).toBeVisible();
});

test('disables summarization for the intentionally empty retrospective', async ({ page }) => {
  await page.goto('/retrospectives?team=beacon&sprint=sprint-04');
  await expect(page.getByText('No notes recorded.')).toHaveCount(2);
  await expect(page.getByText('No action items recorded.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Summarize notes' })).toBeDisabled();
});

test('renders Planning, Review and Retrospective agendas from the selected sprint', async ({ page }) => {
  await page.goto('/agenda?team=atlas&sprint=sprint-06');
  await expect(page.getByRole('heading', { name: 'Planning agenda' })).toBeVisible();
  await expect(page.getByText('45 min', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review agenda' })).toBeVisible();
  await page.getByRole('button', { name: 'Retrospective', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Retrospective agenda' })).toBeVisible();
  await expect(page.getByText('Review 2 recorded actions with the team.')).toBeVisible();
});

test('keyboard users can skip navigation and operate meeting controls', async ({ page }) => {
  await page.goto('/agenda?team=atlas&sprint=sprint-06');
  await expect(page.getByRole('heading', { name: 'Planning agenda' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Team', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Sprint', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Planning', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Review agenda' })).toBeVisible();
});

test('invalid routes offer a way back to the dashboard', async ({ page }) => {
  await page.goto('/sprints/sprint-13?team=atlas');
  await page.getByRole('link', { name: 'Return to the team overview' }).click();
  await expect(page.getByRole('heading', { name: 'Sprint trends' })).toBeVisible();
});
