import type { Retro, Sprint, TeamMetrics } from './types';

export const metricOptions = [
  { key: 'velocity', label: 'Velocity', unit: 'pts', description: 'Story points completed' },
  { key: 'throughput', label: 'Throughput', unit: 'items', description: 'Items completed' },
  { key: 'cycleTimeDays', label: 'Cycle time', unit: 'days', description: 'Median time in progress' },
  { key: 'spilloverRate', label: 'Spillover', unit: '%', description: 'Committed items unfinished' },
  { key: 'goalHitRate', label: 'Goal hit rate', unit: '%', description: 'Sprint goals achieved' },
] as const satisfies ReadonlyArray<{ key: keyof TeamMetrics; label: string; unit: string; description: string }>;

export type Metric = (typeof metricOptions)[number];

export function displayMetric(value: number | null, unit: string) {
  return value === null ? '—' : `${value}${unit === '%' ? '' : ' '}${unit}`;
}

export function teamHref(path: string, team: string, sprint?: string) {
  const query = new URLSearchParams({ team });
  if (sprint) query.set('sprint', sprint);
  return `${path}?${query.toString()}`;
}

export function sprintRange(start: string, end: string) {
  const format = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${format.format(new Date(start))} – ${format.format(new Date(Date.parse(end) - 1))}`;
}

export function summaryInput(retro: Retro) {
  return {
    notes: [
      ...retro.wentWell.map((text, i) => ({ id: `well-${i + 1}`, kind: 'wentWell', text })),
      ...retro.toImprove.map((text, i) => ({ id: `improve-${i + 1}`, kind: 'toImprove', text })),
    ],
    actions: retro.actions,
  };
}

export const meetingKinds = ['Planning', 'Review', 'Retrospective'] as const;
export type Meeting = (typeof meetingKinds)[number];

export function agenda(meeting: Meeting, sprint: Sprint) {
  const { metrics, goal, retrospective } = sprint;
  switch (meeting) {
    case 'Planning':
      return [
        { time: 10, title: 'Agree on a goal', detail: `Use the previous goal as context. ${goal}` },
        { time: 15, title: 'Review unfinished work', detail: `Discuss ${metrics.spilloverCount} unfinished committed items before adding scope.` },
        { time: 20, title: 'Check capacity and commit', detail: `Compare the next sprint capacity with ${metrics.velocity} completed points.` },
      ];
    case 'Review':
      return [
        { time: 10, title: 'Review the goal', detail: `${metrics.goalHit ? 'Goal achieved.' : 'Goal missed.'} ${goal}` },
        { time: 15, title: 'Demo completed work', detail: `Choose highlights from ${metrics.throughput} completed items.` },
        { time: 10, title: 'Collect feedback', detail: 'Capture stakeholder feedback and discuss changes to the backlog.' },
      ];
    case 'Retrospective':
      return [
        { time: 10, title: 'Set the context', detail: 'Share the burndown and invite each person to add an observation.' },
        { time: 15, title: 'Discuss what helped and what slowed work', detail: 'Use the recorded notes and identify one recurring theme.' },
        { time: 10, title: 'Confirm owners and next steps', detail: `Review ${retrospective.actions.length} recorded actions with the team.` },
      ];
  }
}
