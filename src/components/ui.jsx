import { href } from '../router.js';
import { frTime } from '../format.js';

export function TeamLogo({ team, size = 36 }) {
  if (!team?.logo) return <span className="logo-fallback" style={{ width: size, height: size }}>{team?.abbr}</span>;
  return <img className="team-logo" src={team.logo} alt={team.abbr} width={size} height={size} loading="lazy" />;
}

export function Loading({ label = 'Chargement…' }) {
  return <div className="state"><span className="spinner" />{label}</div>;
}

export function ErrorState({ error }) {
  return (
    <div className="state error">
      <b>Impossible de charger les données.</b>
      <span>{error?.message || 'Vérifie ta connexion puis réessaie.'}</span>
      <button className="btn" onClick={() => window.location.reload()}>Réessayer</button>
    </div>
  );
}

/** Carte d'un match dans la liste des résultats. */
export function GameCard({ game, date }) {
  const { home, away } = game;
  const final = game.status === 'final';
  const row = (t) => (
    <div className={`gc-team ${final && !t.winner ? 'loser' : ''}`}>
      <TeamLogo team={t} size={32} />
      <span className="gc-name">{t.shortName}</span>
      <span className="gc-record">{t.record}</span>
      <span className="gc-score">{final ? t.score : ''}</span>
    </div>
  );
  const body = (
    <>
      <div className="gc-teams">{row(away)}{row(home)}</div>
      <div className="gc-foot">
        <span className={`badge ${final ? '' : 'badge-muted'}`}>
          {final ? (home.linescores.length > 4 ? `Final · ${home.linescores.length > 5 ? home.linescores.length - 4 + ' prol.' : 'prol.'}` : 'Final') : game.status === 'postponed' ? 'Reporté' : frTime(game.date)}
        </span>
        {final && game.recap && <span className="gc-title">{game.recap.title}</span>}
      </div>
    </>
  );
  return final ? <a className="game-card" href={href('match', date, game.id)}>{body}</a> : <div className="game-card">{body}</div>;
}

export function Tabs({ tabs, active, base }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <a key={t.key} role="tab" aria-selected={active === t.key} className={`tab ${active === t.key ? 'active' : ''}`} href={href(...base, t.key)}>
          {t.label}
        </a>
      ))}
    </div>
  );
}
