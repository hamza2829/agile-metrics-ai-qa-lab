export interface Team {
  id: string;
  name: string;
  focus: string;
}

export interface TeamMetrics {
  velocity: number;
  throughput: number;
  cycleTimeDays: number | null;
  spilloverRate: number;
  goalHitRate: number;
}

export interface SprintMetrics extends TeamMetrics {
  spilloverCount: number;
  committedCount: number;
  plannedPoints: number;
  addedPoints: number;
  goalHit: boolean;
}

export interface SprintHeader {
  id: string;
  name: string;
  number: number;
  start: string;
  end: string;
  goal: string;
}

export type SprintSummary = SprintHeader & SprintMetrics;

export interface Overview {
  team: Team;
  metrics: TeamMetrics;
  sprints: SprintSummary[];
}

export type Status = 'To Do' | 'In Progress' | 'Done';

export interface Issue {
  key: string;
  summary: string;
  issueType: 'Story' | 'Bug';
  storyPoints: number;
  addedAt: string;
  statusAtClose: Status;
  carryoverFrom: string | null;
  statusChanges: { at: string; status: Status }[];
}

export interface BurndownDay {
  day: number;
  date: string;
  remaining: number;
  ideal: number;
}

export interface Action {
  id: string;
  text: string;
  owner: string;
}

export interface Retro {
  wentWell: string[];
  toImprove: string[];
  actions: Action[];
}

export interface Sprint extends SprintHeader {
  team: Team;
  issues: Issue[];
  metrics: SprintMetrics & { burndown: BurndownDay[] };
  retrospective: Retro;
}

export interface Summary {
  mode: 'mock';
  themes: { theme: string; label: string; noteIds: string[] }[];
  suggestedActions: Action[];
}
