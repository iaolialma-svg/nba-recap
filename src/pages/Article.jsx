import { loadDay, useData } from '../api.js';
import { href } from '../router.js';
import { nightLabel, paragraphs, timeAgo } from '../format.js';
import { ErrorState, Loading } from '../components/ui.jsx';

export default function Article({ date, id }) {
  const { data, error, loading } = useData(() => loadDay(date), [date]);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const a = data.articles.find((x) => x.id === id);
  if (!a) return <div className="state">Article introuvable. <a href={href()}>Retour à l'accueil</a></div>;
  const game = a.gameId && data.games.find((g) => g.id === a.gameId);

  return (
    <article className="page article">
      <a className="back" href={href()}>← Accueil</a>
      <p className="kicker">{a.category === 'nuit' ? nightLabel(data.date) : `News${a.published ? ' · ' + timeAgo(a.published) : ''}`}</p>
      <h1>{a.title}</h1>
      {a.teaser && a.teaser !== a.body && <p className="lede">{a.teaser}</p>}
      {a.image && <img className="article-img" src={a.image} alt="" />}
      {paragraphs(a.body).map((p, i) => <p key={i}>{p}</p>)}
      {game && <a className="btn" href={href('match', data.date, game.id)}>Voir la fiche du match {game.away.abbr}-{game.home.abbr} →</a>}
      {a.sourceUrl && <p className="source">Source : <a href={a.sourceUrl} target="_blank" rel="noreferrer">{a.sourceName || 'lien'}</a></p>}
    </article>
  );
}
