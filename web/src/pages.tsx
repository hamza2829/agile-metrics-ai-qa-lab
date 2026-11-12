import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarDays, CircleHelp, Clock3, Layers, Sparkles, Target } from 'lucide-react';
import { getJson, useJson } from './api';
import { Burndown, SprintLink, Trend } from './charts';
import type { Action, Overview, Retro, Sprint, Summary, TeamMetrics } from './types';
import {
  agenda, displayMetric, meetingKinds, metricOptions, sprintRange, summaryInput, teamHref, type Meeting,
} from './view-model';

const icons = [BarChart3, Layers, Clock3, CalendarDays, Target];

export function MetricCards({ metrics }: { metrics: TeamMetrics }) {
  return <div className="metric-grid">
    {metricOptions.map((metric, i) => {
      const Icon = icons[i];
      return <article className="metric-card" key={metric.key}>
        <div className={`metric-icon tint-${i}`}><Icon size={17} aria-hidden="true" /></div>
        <h2>{metric.label}</h2>
        <strong>{displayMetric(metrics[metric.key], metric.unit)}</strong>
        <p>{metric.description}</p>
      </article>;
    })}
  </div>;
}

function LoadState({ error }: { error?: string }) {
  return error ? <p className="panel" role="alert">{error}</p>
    : <p className="panel" role="status">Loading sprint data…</p>;
}

export function OverviewPage({ team }: { team: string }) {
  const result = useJson<Overview>(`/api/teams/${team}/sprints`);
  const [metricKey, setMetricKey] = useState<keyof TeamMetrics>('velocity');
  if (result.kind !== 'ready') return <LoadState error={result.kind === 'error' ? result.message : undefined} />;
  const { metrics, sprints } = result.data;
  const metric = metricOptions.find((option) => option.key === metricKey) ?? metricOptions[0];
  return <>
    <MetricCards metrics={metrics} />
    <section className="panel trend-panel">
      <div className="section-head">
        <div><h2>Sprint trends</h2><p>Compare delivery over 12 sprints. Select a bar to inspect the sprint.</p></div>
        <label className="field">Metric
          <select value={metricKey} onChange={(event) => setMetricKey(event.currentTarget.value as keyof TeamMetrics)}>
            {metricOptions.map(({ key, label }) => <option value={key} key={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <Trend sprints={sprints} metric={metric} team={team} />
      <p className="chart-caption"><i /> Striped bars mark a sprint with added story points.</p>
    </section>
    <section className="panel">
      <div className="section-head"><div><h2>Sprint history</h2><p>Plan, delivery, and goal outcomes</p></div></div>
      <div className="table-scroll" role="region" aria-label="Sprint history table" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Sprint</th><th scope="col">Dates</th><th scope="col">Planned</th><th scope="col">Velocity</th><th scope="col">Spillover</th><th scope="col">Goal</th></tr></thead>
          <tbody>{sprints.map((sprint) => <tr key={sprint.id}>
            <th scope="row"><SprintLink sprint={sprint} team={team} /></th>
            <td>{sprintRange(sprint.start, sprint.end)}</td><td>{sprint.plannedPoints} pts</td>
            <td>{sprint.velocity} pts</td><td>{sprint.spilloverRate}%</td>
            <td><Goal hit={sprint.goalHit} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}

export function SprintChoice({ id, onChange }: { id: string; onChange: (value: string) => void }) {
  return <label className="field">Sprint
    <select value={id} onChange={(event) => onChange(event.currentTarget.value)}>
      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((number) => (
        <option key={number} value={`sprint-${number}`}>Sprint {number}</option>
      ))}
    </select>
  </label>;
}

function Goal({ hit }: { hit: boolean }) {
  return <span className={`pill ${hit ? 'success' : 'caution'}`}>{hit ? 'Achieved' : 'Missed'}</span>;
}

export function SprintPage({ team, sprint }: { team: string; sprint: string }) {
  const result = useJson<Sprint>(`/api/teams/${team}/sprints/${sprint}`);
  const [filter, setFilter] = useState('all');
  if (result.kind !== 'ready') return <LoadState error={result.kind === 'error' ? result.message : undefined} />;
  const detail = result.data;
  const issues = detail.issues.filter((issue) => filter === 'all' || issue.statusAtClose === filter);
  return <>
    <section className="panel goal-panel">
      <div className="section-head">
        <div><h2>Sprint goal</h2><p>{detail.goal}</p></div><Goal hit={detail.metrics.goalHit} />
      </div>
      <div className="goal-foot">
        <span>{sprintRange(detail.start, detail.end)} · {detail.metrics.plannedPoints} points committed</span>
        {detail.metrics.addedPoints > 0 && <strong>+{detail.metrics.addedPoints} points added during the sprint</strong>}
        <Link to={teamHref('/retrospectives', team, sprint)}>Read retrospective <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
    <MetricCards metrics={detail.metrics} />
    <Burndown days={detail.metrics.burndown} />
    <section className="panel">
      <div className="section-head">
        <div><h2>Sprint issues</h2><p>Expand an issue to inspect the status history.</p></div>
        <label className="field">Status
          <select value={filter} onChange={(event) => setFilter(event.currentTarget.value)}>
            <option value="all">All statuses</option><option>Done</option>
            <option>In Progress</option><option>To Do</option>
          </select>
        </label>
      </div>
      {!issues.length && <p className="empty">No issues match this status.</p>}
      {issues.map((issue) => <details key={issue.key} className="issue">
        <summary><span className="issue-key">{issue.key}</span> {issue.summary}
          <span className="pill">{issue.statusAtClose}</span>
        </summary>
        <p>{issue.issueType} · {issue.storyPoints} pts
          {issue.carryoverFrom ? ` · Carried from ${issue.carryoverFrom.replace('-', ' ')}` : ''}
        </p>
        <ol>{issue.statusChanges.map(({ status, at }) => <li key={at}>
          <strong>{status}</strong> · <time dateTime={at}>{at.replace('T', ' ').replace('Z', ' UTC')}</time>
        </li>)}</ol>
      </details>)}
    </section>
  </>;
}

function Notes({ title, notes }: { title: string; notes: string[] }) {
  return <section className="panel"><h2>{title}</h2>
    {notes.length ? <ul className="notes">{notes.map((text, i) => <li key={i}>{text}</li>)}</ul>
      : <p className="empty">No notes recorded.</p>}
  </section>;
}

function Actions({ items }: { items: Action[] }) {
  if (!items.length) return <p className="empty">No action items recorded.</p>;
  return <ul className="action-list">{items.map((item) => (
    <li key={item.id}><span>{item.text}</span><strong className="pill">{item.owner}</strong></li>
  ))}</ul>;
}

function SummaryPanel({ retro }: { retro: Retro }) {
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const payload = summaryInput(retro);
  const noteTexts = new Map(payload.notes.map(({ id, text }) => [id, text]));

  async function run() {
    setPending(true);
    setError('');
    try {
      setSummary(await getJson<Summary>('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }));
    } catch {
      setError('The summary couldn’t load. Try again.');
    } finally {
      setPending(false);
    }
  }
  return <section className="panel ai-panel">
    <div className="section-head">
      <div><h2><Sparkles size={19} aria-hidden="true" /> AI summary</h2><p>Deterministic mock · suggestions come from recorded actions</p></div>
      <button className="primary" onClick={run} disabled={pending || !payload.notes.length}>
        {pending ? 'Summarizing…' : 'Summarize notes'}
      </button>
    </div>
    {!payload.notes.length && <p className="empty">A summary requires retrospective notes.</p>}
    {error && <p role="alert">{error}</p>}
    {summary && <>
      <p className="summary-status" role="status">Summary ready. {summary.themes.length} themes found.</p>
      <div className="split">
        <div><h3>Themes</h3>
          {summary.themes.length ? <ul className="theme-list">{summary.themes.map((item) => <li key={item.theme}>
            <strong>{item.label}</strong>
            <p>{item.noteIds.map((id) => noteTexts.get(id)).filter(Boolean).join(' ')}</p>
          </li>)}</ul> : <p className="empty">No themes matched the notes.</p>}
        </div>
        <div><h3>Suggested actions</h3><Actions items={summary.suggestedActions} /></div>
      </div>
    </>}
  </section>;
}

export function RetroPage({ team, sprint }: { team: string; sprint: string }) {
  const result = useJson<Sprint>(`/api/teams/${team}/sprints/${sprint}`);
  if (result.kind !== 'ready') return <LoadState error={result.kind === 'error' ? result.message : undefined} />;
  const { retrospective } = result.data;
  return <>
    <div className="split">
      <Notes title="What went well" notes={retrospective.wentWell} />
      <Notes title="What to improve" notes={retrospective.toImprove} />
    </div>
    <section className="panel"><h2>Action items</h2><Actions items={retrospective.actions} /></section>
    <SummaryPanel key={`${team}/${sprint}`} retro={retrospective} />
  </>;
}

export function AgendaPage({ team, sprint }: { team: string; sprint: string }) {
  const result = useJson<Sprint>(`/api/teams/${team}/sprints/${sprint}`);
  const [meeting, setMeeting] = useState<Meeting>('Planning');
  if (result.kind !== 'ready') return <LoadState error={result.kind === 'error' ? result.message : undefined} />;
  const items = agenda(meeting, result.data);
  return <section className="panel agenda">
    <div className="segmented" role="group" aria-label="Meeting type">
      {meetingKinds.map((kind) => <button key={kind} aria-pressed={meeting === kind}
        onClick={() => setMeeting(kind)}>{kind}</button>)}
    </div>
    <div className="section-head">
      <div><h2>{meeting} agenda</h2><p>Based on {result.data.name} for {result.data.team.name}</p></div>
      <span className="pill"><Clock3 size={15} aria-hidden="true" /> {items.reduce((sum, item) => sum + item.time, 0)} min</span>
    </div>
    <ol className="agenda-list">{items.map((item) => <li key={item.title}>
      <span className="duration">{item.time} min</span><div><h3>{item.title}</h3><p>{item.detail}</p></div>
    </li>)}</ol>
    <p className="agenda-note"><CircleHelp size={16} aria-hidden="true" /> Adjust the agenda with your team before the meeting.</p>
  </section>;
}
