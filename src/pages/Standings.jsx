import { useState } from 'react';
import { loadStandings, useData } from '../api.js';
import { ErrorState, Loading } from '../components/ui.jsx';
import { StandingsTable } from './Game.jsx';

export default function Standings() {
  const { data, error, loading } = useData(() => loadStandings(), []);
  const [conf, setConf] = useState('Est');
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const c = data.conferences.find((x) => x.name === conf) || data.conferences[0];
  return (
    <div className="page">
      <div className="page-head">
        <p className="kicker">Saison régulière</p>
        <h1>Classements</h1>
      </div>
      <div className="seg">
        {data.conferences.map((x) => (
          <button key={x.name} className={x.name === c.name ? 'active' : ''} onClick={() => setConf(x.name)}>Conférence {x.name}</button>
        ))}
      </div>
      <StandingsTable conf={c} />
      <p className="muted small">1-6 : qualifiés pour les playoffs · 7-10 : play-in</p>
    </div>
  );
}
