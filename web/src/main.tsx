import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, CalendarDays, ClipboardList, LayoutGrid, MessageSquareText } from 'lucide-react';
import { useJson } from './api';
import { AgendaPage, OverviewPage, RetroPage, SprintChoice, SprintPage } from './pages';
import type { Team } from './types';
import { teamHref } from './view-model';
import './styles.css';

const defaultSprint = 'sprint-06';
const navItems = [
  { path: '/', label: 'Team overview', Icon: LayoutGrid },
  { path: '/sprints', label: 'Sprint details', Icon: CalendarDays },
  { path: '/retrospectives', label: 'Retrospectives', Icon: MessageSquareText },
  { path: '/agenda', label: 'Meeting agenda', Icon: ClipboardList },
];

function Shell() {
  const result = useJson<Team[]>('/api/teams');
  const [query] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const teams = result.kind === 'ready' ? result.data : [];
  const team = teams.find(({ id }) => id === query.get('team')) ?? teams[0];
  const detailPath = pathname.match(/^\/sprints\/([^/]+)$/);
  const sprint = detailPath?.[1] ?? query.get('sprint') ?? defaultSprint;
  const knownSprint = /^sprint-(0[1-9]|1[0-2])$/.test(sprint);
  const section = navItems.find(({ path }) => path === pathname || pathname.startsWith(path + '/'));
  const title = detailPath && knownSprint ? `Sprint ${sprint.slice(-2)}` : section?.label ?? 'Page unavailable';
  const showSprint = Boolean(detailPath) || pathname === '/retrospectives' || pathname === '/agenda';
  const validPath = pathname === '/' || Boolean(detailPath) || ['/retrospectives', '/agenda'].includes(pathname);

  function changeSprint(value: string) {
    navigate(teamHref(detailPath ? `/sprints/${value}` : pathname, team.id, detailPath ? undefined : value));
  }

  return <div className="layout">
    <a className="skip" href="#main">Skip to content</a>
    <aside className="sidebar">
      <Link to={teamHref('/', team?.id ?? 'atlas')} className="brand">
        <span className="brand-icon"><Activity size={22} aria-hidden="true" /></span>
        <span>Sprintboard <small>Agile metrics lab</small></span>
      </Link>
      <nav aria-label="Dashboard">
        {navItems.map(({ path, label, Icon }) => {
          const target = path === '/sprints' ? `/sprints/${knownSprint ? sprint : defaultSprint}` : path;
          const active = path === '/' ? pathname === path : pathname.startsWith(path);
          return <NavLink key={path}
            to={teamHref(target, team?.id ?? 'atlas', path === '/agenda' || path === '/retrospectives' ? (knownSprint ? sprint : defaultSprint) : undefined)}
            className={active ? 'nav-link active' : 'nav-link'} aria-current={active ? 'page' : undefined} end>
            <Icon size={18} aria-hidden="true" /><span>{label}</span>
          </NavLink>;
        })}
      </nav>
      <div className="sidebar-foot"><span /> Synthetic workspace</div>
    </aside>
    <main id="main" tabIndex={-1}>
      <header className="page-head">
        <div><div className="context">{team?.name ?? 'Sprintboard'}{team && ` / ${team.focus}`}</div><h1>{title}</h1></div>
        {team && <div className="page-fields">
          <label className="field">Team
            <select value={team.id} onChange={(event) => navigate(teamHref(pathname, event.currentTarget.value, detailPath ? undefined : sprint))}>
              {teams.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          {showSprint && knownSprint && <SprintChoice id={sprint} onChange={changeSprint} />}
        </div>}
      </header>
      {result.kind === 'error' && <p className="panel" role="alert">{result.message}</p>}
      {result.kind === 'loading' && <p className="panel" role="status">Loading teams…</p>}
      {result.kind === 'ready' && !team && <p className="panel">No teams are available.</p>}
      {team && (!validPath || showSprint && !knownSprint) && <section className="panel">
        <p>We couldn’t find this page.</p><Link to={teamHref('/', team.id)}>Return to the team overview</Link>
      </section>}
      {team && validPath && (!showSprint || knownSprint) && <Routes>
        <Route path="/" element={<OverviewPage team={team.id} />} />
        <Route path="/sprints/:id" element={<SprintPage team={team.id} sprint={sprint} />} />
        <Route path="/retrospectives" element={<RetroPage team={team.id} sprint={sprint} />} />
        <Route path="/agenda" element={<AgendaPage team={team.id} sprint={sprint} />} />
      </Routes>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><Shell /></BrowserRouter>);
