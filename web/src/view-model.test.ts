import { describe, expect, test } from 'vitest';
import type { Retro, Sprint } from './types';
import { agenda, displayMetric, sprintRange, summaryInput, teamHref } from './view-model';

const retro: Retro = {
  wentWell: ['Pairing helped.'],
  toImprove: ['Code review took two days.'],
  actions: [{ id: 'a1', text: 'Reserve review time.', owner: 'Sam Lee' }],
};
const sprint: Sprint = {
  id: 'sprint-06', name: 'Sprint 06', number: 6,
  start: '2026-03-16T00:00:00Z', end: '2026-03-30T00:00:00Z',
  goal: 'Improve search.', team: { id: 'atlas', name: 'Atlas', focus: 'Customer experience' },
  issues: [], retrospective: retro,
  metrics: {
    velocity: 19, throughput: 5, cycleTimeDays: 3, spilloverRate: 20, goalHitRate: 50,
    spilloverCount: 2, committedCount: 10, plannedPoints: 23, addedPoints: 4, goalHit: false,
    burndown: [],
  },
};

describe('Metric labels and links', () => {
  test.each([
    [0, 'pts', '0 pts'], [33.3, '%', '33.3%'], [null, 'days', '—'], [2.5, 'days', '2.5 days'],
  ])('displays %s in %s', (value, unit, expected) => {
    expect(displayMetric(value, unit)).toBe(expected);
  });

  test('retains both the selected team and sprint in a shared link', () => {
    expect(teamHref('/retrospectives', 'atlas', 'sprint-06')).toBe('/retrospectives?team=atlas&sprint=sprint-06');
  });

  test('formats the visible range using the last included calendar date', () => {
    expect(sprintRange(sprint.start, sprint.end)).toBe('16 Mar – 29 Mar');
  });
});

describe('Retrospective and meeting content', () => {
  test('sends both note categories with stable evidence IDs', () => {
    const input = summaryInput(retro);
    expect(input.notes).toEqual([
      { id: 'well-1', kind: 'wentWell', text: 'Pairing helped.' },
      { id: 'improve-1', kind: 'toImprove', text: 'Code review took two days.' },
    ]);
    expect(input.actions).toEqual(retro.actions);
  });

  test('keeps an empty retrospective empty', () => {
    expect(summaryInput({ wentWell: [], toImprove: [], actions: [] })).toEqual({ notes: [], actions: [] });
  });

  test('planning references unfinished work and completed points', () => {
    const plan = agenda('Planning', sprint);
    expect(plan[1].detail).toContain('2 unfinished');
    expect(plan[2].detail).toContain('19 completed points');
  });

  test('review distinguishes missed from achieved goals', () => {
    expect(agenda('Review', sprint)[0].detail).toContain('Goal missed.');
    expect(agenda('Review', { ...sprint, metrics: { ...sprint.metrics, goalHit: true } })[0].detail)
      .toContain('Goal achieved.');
  });

  test('review proposes highlights from throughput', () => {
    expect(agenda('Review', sprint)[1].detail).toContain('5 completed items');
  });

  test('retrospective agenda references recorded actions and owners', () => {
    const items = agenda('Retrospective', sprint);
    expect(items[2].title).toContain('owners');
    expect(items[2].detail).toContain('1 recorded actions');
  });
});
