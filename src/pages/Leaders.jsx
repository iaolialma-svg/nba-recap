import { loadLeaders, useData } from '../api.js';
import { ErrorState, Loading, Tabs, TeamLogo } from '../components/ui.jsx';
import { FollowedList } from './Players.jsx';
import { timeAgo } from '../format.js';

const fmt = (v, signed) => {
  const s = v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return signed && v > 0 ? `+${s}` : s;
};

function LeaderCard({ cat }) {
  const [first, ...rest] = cat.players;
  if (!first) return null;
  return (
    <section className="card leader-card">
      <header className="lc-head">
        <h2>{cat.label}</h2>
        <span className="muted small">{cat.unit}</span>
      </header>
      <div className="lc-first">
        <div className="lc-photo">
          {first.headshot ? <img src={first.headshot} alt="" loading="lazy" /> : null}
          <span className="lc-rank">1</span>
        </div>
        <div className="lc-who">
          <strong>{first.name}</strong>
          <span className="muted small lc-team"><TeamLogo team={{ logo: first.logo, abbr: first.team }} size={16} />{first.team} · {first.gp} matches</span>
        </div>
        <div className={`lc-big ${cat.signed && first.value < 0 ? 'neg' : ''}`}>{fmt(first.value, cat.signed)}</div>
      </div>
      <ol className="lc-list" start={2}>
        {rest.map((p, i) => (
          <li key={p.id}>
            <span className="lc-n">{i + 2}</span>
            <TeamLogo team={{ logo: p.logo, abbr: p.team }} size={18} />
            <span className="lc-name">{p.name}<span className="muted small"> · {p.team}</span></span>
            <span className={`lc-val ${cat.signed && p.value < 0 ? 'neg' : ''}`}>{fmt(p.value, cat.signed)}</span>
          </li>
        ))}
      </ol>
      {cat.key === 'pm' && (
        <p className="muted small lc-note">Écart de points de son équipe pendant qu'il est sur le terrain, en moyenne par match.</p>
      )}
    </section>
  );
}

const TABS = [
  { key: 'classements', label: 'Classements' },
  { key: 'suivis', label: 'Mes joueurs' },
];

export default function Joueurs({ tab }) {
  const active = tab === 'suivis' ? 'suivis' : 'classements';
  return (
    <div className="page">
      <div className="page-head">
        <p className="kicker">Saison régulière</p>
        <h1>Joueurs</h1>
      </div>
      <Tabs tabs={TABS} active={active} base={['joueurs']} />
      {active === 'suivis' ? <FollowedList /> : <LeadersView />}
    </div>
  );
}

function LeadersView() {
  const { data, error, loading } = useData(() => loadLeaders(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <div className="leaders-grid">
        {data.categories.map((c) => <LeaderCard key={c.key} cat={c} />)}
      </div>
      <p className="muted small">
        Saison {data.season}. Moyennes par match. Seuls les joueurs qualifiés selon ESPN (assez de matches joués) sont classés. Mis à jour {timeAgo(data.generatedAt)}.
      </p>
    </>
  );
}
