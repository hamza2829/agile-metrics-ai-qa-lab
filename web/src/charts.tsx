import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BurndownDay, SprintSummary } from './types';
import { displayMetric, teamHref, type Metric } from './view-model';

export function Trend({ sprints, metric, team }: { sprints: SprintSummary[]; metric: Metric; team: string }) {
  const max = Math.max(1, ...sprints.map((sprint) => sprint[metric.key] ?? 0));
  return (
    <div className="trend">
      {sprints.map((sprint) => {
        const value = sprint[metric.key];
        return (
          <Link key={sprint.id} to={teamHref(`/sprints/${sprint.id}`, team)}
            className="trend-column"
            title={`${sprint.name} · ${displayMetric(value, metric.unit)}`}>
            <span className="trend-label">
              <span className="sr-only">Sprint </span>{String(sprint.number).padStart(2, '0')}
            </span>
            <span className="trend-number">
              <span className="sr-only">, {metric.label} </span>{value ?? '—'}
              <span className="sr-only">
                {value === null ? ' no cycle-time sample' : ` ${metric.unit}`}
                {sprint.addedPoints > 0 && ', added scope'}
              </span>
            </span>
            <span className="trend-track" aria-hidden="true">
              <span className={sprint.addedPoints > 0 ? 'trend-bar scope' : 'trend-bar'}
                style={{ height: `${Math.max(2, 100 * (value ?? 0) / max)}%` }} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function Burndown({ days }: { days: BurndownDay[] }) {
  const max = Math.max(1, ...days.map((day) => Math.max(day.ideal, day.remaining)));
  const last = Math.max(1, days.length - 1);
  const x = (day: number) => 44 + 692 * day / last;
  const y = (points: number) => 188 - 164 * points / max;
  const points = (field: 'ideal' | 'remaining') => days.map((day) => `${x(day.day)},${y(day[field])}`).join(' ');
  return (
    <section className="panel">
      <div className="section-head">
        <div><h2>Sprint burndown</h2><p>Remaining story points at each daily boundary</p></div>
        <div className="legend"><span><i /> Actual</span><span><i className="ideal" /> Ideal</span></div>
      </div>
      <svg className="burndown" viewBox="0 0 764 216" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = max * tick / 4;
          return <g key={tick}>
            <line x1="44" x2="736" y1={y(value)} y2={y(value)} className="axis-line" />
            <text x="37" y={y(value) + 4} textAnchor="end">{Math.round(value)}</text>
          </g>;
        })}
        <polyline className="ideal-line" points={points('ideal')} />
        <polyline className="actual-line" points={points('remaining')} />
        {days.filter(({ day }) => day % 2 === 0).map(({ day }) => (
          <text key={day} x={x(day)} y="209" textAnchor="middle">{day}</text>
        ))}
      </svg>
      <details>
        <summary>View burndown data</summary>
        <table><thead><tr><th scope="col">Day</th><th scope="col">Actual points</th><th scope="col">Ideal points</th></tr></thead>
          <tbody>{days.map((day) => (
            <tr key={day.day}><th scope="row">{day.day}</th><td>{day.remaining}</td><td>{day.ideal}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </section>
  );
}

export function SprintLink({ sprint, team }: { sprint: SprintSummary; team: string }) {
  return <Link to={teamHref(`/sprints/${sprint.id}`, team)} className="sprint-link">
    {sprint.name}<ArrowUpRight size={14} aria-hidden="true" />
  </Link>;
}
