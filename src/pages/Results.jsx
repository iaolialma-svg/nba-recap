import { loadDay, loadIndex, useData } from '../api.js';
import { href } from '../router.js';
import { nightLabel, shortDate } from '../format.js';
import { ErrorState, GameCard, Loading } from '../components/ui.jsx';

export default function Results({ date }) {
  const idx = useData(() => loadIndex(), []);
  const day = useData(() => loadDay(date), [date]);
  if (day.loading) return <Loading />;
  if (day.error) return <ErrorState error={day.error} />;

  const d = day.data;
  const dates = idx.data?.dates || [d.date];
  const i = dates.indexOf(d.date);
  const newer = i > 0 ? dates[i - 1] : null;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;

  return (
    <div className="page">
      <div className="page-head">
        <p className="kicker">Résultats</p>
        <div className="date-nav">
          <a className={`icon-btn ${older ? '' : 'disabled'}`} href={older ? href('resultats', older) : undefined} aria-label="Nuit précédente">‹</a>
          <h1>{nightLabel(d.date)}</h1>
          <a className={`icon-btn ${newer ? '' : 'disabled'}`} href={newer ? href('resultats', newer) : undefined} aria-label="Nuit suivante">›</a>
        </div>
      </div>
      {dates.length > 1 && (
        <div className="chips">
          {dates.slice(0, 14).map((x) => (
            <a key={x} className={`chip ${x === d.date ? 'active' : ''}`} href={href('resultats', x)}>{shortDate(x)}</a>
          ))}
        </div>
      )}
      {d.games.length === 0 ? (
        <div className="state">Pas de match NBA cette nuit-là.</div>
      ) : (
        <div className="game-list">
          {d.games.map((g) => <GameCard key={g.id} game={g} date={d.date} />)}
        </div>
      )}
    </div>
  );
}
