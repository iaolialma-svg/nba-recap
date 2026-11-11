import { loadDay, useData } from '../api.js';
import { href } from '../router.js';
import { nightLabel, timeAgo } from '../format.js';
import { ErrorState, Loading, TeamLogo } from '../components/ui.jsx';

function ArticleVisual({ article, games }) {
  const game = article.gameId && games.find((g) => g.id === article.gameId);
  if (article.image) return <img className="art-img" src={article.image} alt="" loading="lazy" />;
  if (game) {
    return (
      <div className="art-img art-duel" style={{ '--c1': game.away.color, '--c2': game.home.color }}>
        <TeamLogo team={game.away} size={56} /><span>{game.away.score}-{game.home.score}</span><TeamLogo team={game.home} size={56} />
      </div>
    );
  }
  return <div className="art-img art-night"><span className="brand-ball big" /></div>;
}

export default function Home() {
  const { data, error, loading } = useData(() => loadDay(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const finals = data.games.filter((g) => g.status === 'final');
  const night = data.articles.filter((a) => a.category === 'nuit');
  const news = data.articles.filter((a) => a.category === 'news');
  const [lead, ...restNight] = night;

  return (
    <div className="page">
      <div className="page-head">
        <p className="kicker">{nightLabel(data.date)}</p>
        <h1>La nuit NBA</h1>
      </div>

      {finals.length > 0 && (
        <div className="ticker" aria-label="Scores de la nuit">
          {finals.map((g) => (
            <a key={g.id} className="tick" href={href('match', data.date, g.id)}>
              <span className={g.away.winner ? 'w' : ''}><TeamLogo team={g.away} size={18} />{g.away.abbr} {g.away.score}</span>
              <span className={g.home.winner ? 'w' : ''}><TeamLogo team={g.home} size={18} />{g.home.abbr} {g.home.score}</span>
            </a>
          ))}
          <a className="tick tick-all" href={href('resultats', data.date)}>Tous les résultats →</a>
        </div>
      )}

      {lead && (
        <a className="hero" href={href('article', data.date, lead.id)}>
          <ArticleVisual article={lead} games={data.games} />
          <div className="hero-body">
            <span className="tag">La nuit</span>
            <h2>{lead.title}</h2>
            <p>{lead.teaser}</p>
          </div>
        </a>
      )}

      {restNight.length > 0 && (
        <section>
          <h3 className="section-title">À la une cette nuit</h3>
          <div className="art-grid">
            {restNight.map((a) => <ArticleCard key={a.id} a={a} date={data.date} games={data.games} />)}
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section>
          <h3 className="section-title">Les news NBA</h3>
          <div className="art-grid">
            {news.map((a) => <ArticleCard key={a.id} a={a} date={data.date} games={data.games} />)}
          </div>
        </section>
      )}

      {!data.ai && <p className="footnote">Résumés générés automatiquement. Ajoute une clé API Claude pour des articles rédigés en français.</p>}
    </div>
  );
}

function ArticleCard({ a, date, games }) {
  return (
    <a className="art-card" href={href('article', date, a.id)}>
      <ArticleVisual article={a} games={games} />
      <div className="art-body">
        <span className="tag">{a.category === 'nuit' ? 'La nuit' : 'News'}{a.lang === 'en' ? ' · EN' : ''}</span>
        <h4>{a.title}</h4>
        <p>{a.teaser}</p>
        {a.published && a.category === 'news' && <span className="meta">{timeAgo(a.published)}</span>}
      </div>
    </a>
  );
}
