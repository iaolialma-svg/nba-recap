import { loadPlayers, useData } from '../api.js';
import { ErrorState, Loading, TeamLogo } from '../components/ui.jsx';
import { href } from '../router.js';
import { timeAgo } from '../format.js';

const f1 = (v) => (v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const n0 = (v) => (v === null || v === undefined ? '–' : v);
// Date du match à l'heure américaine (celle du calendrier NBA).
const gameDay = (iso) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'America/New_York', day: 'numeric', month: 'short' }).format(new Date(iso));

const INJURY = { 'Day-To-Day': 'Incertain', Out: 'Absent', Questionable: 'Incertain', Doubtful: 'Douteux', Suspension: 'Suspendu' };
const POS = { Guard: 'Arrière', Forward: 'Ailier', Center: 'Pivot', 'Point Guard': 'Meneur', 'Shooting Guard': 'Arrière', 'Small Forward': 'Ailier', 'Power Forward': 'Ailier fort' };
const posLabel = (s) => (s || '').split('-').map((x) => POS[x.trim()] || x).join('-');
const injuryLabel = (s) => INJURY[s] || s;
// "18th Season" -> "18e saison" ; "Rookie" -> "Rookie"
const expLabel = (s) => { const m = /^(\d+)/.exec(s || ''); return m ? (m[1] === '1' ? '1re saison' : `${m[1]}e saison`) : s; };

/** Liste des joueurs suivis (onglet "Mes joueurs" de la rubrique Joueurs). */
export function FollowedList() {
  const { data, error, loading } = useData(() => loadPlayers(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <div className="followed-grid">
        {data.players.map((p) => {
          const s = p.season;
          const l = p.last5.avg;
          const diff = s && l ? l.pts - s.pts : 0;
          return (
            <a key={p.id} className="card fp-card" href={href('joueur', p.id)}>
              <div className="fp-photo">{p.headshot && <img src={p.headshot} alt="" loading="lazy" />}</div>
              <div className="fp-main">
                <div className="fp-name">
                  <strong>{p.name}</strong>
                  {p.injury && <span className="inj">{injuryLabel(p.injury.status)}</span>}
                </div>
                <span className="muted small fp-team"><TeamLogo team={{ logo: p.logo, abbr: p.team }} size={16} />{p.team} · {posLabel(p.position)}</span>
                {s ? (
                  <div className="fp-line">
                    <span><b>{f1(s.pts)}</b> pts</span><span><b>{f1(s.reb)}</b> reb</span><span><b>{f1(s.ast)}</b> pd</span>
                  </div>
                ) : <div className="muted small">Pas encore de match cette saison</div>}
              </div>
              {l && s && (
                <div className={`fp-trend ${diff >= 1 ? 'up' : diff <= -1 ? 'down' : ''}`} title="Points sur les 5 derniers matches">
                  <span className="muted small">5 der.</span>
                  <b>{f1(l.pts)}</b>
                </div>
              )}
            </a>
          );
        })}
      </div>
      <p className="muted small">Moyennes par match en saison régulière. Mis à jour {timeAgo(data.generatedAt)}.</p>
    </>
  );
}

function AvgTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="box avg-table">
        <thead>
          <tr><th className="pname" /><th>MJ</th><th>MIN</th><th>PTS</th><th>REB</th><th>PD</th><th>INT</th><th>CTR</th><th>BP</th><th>TIRS %</th><th>3PTS %</th><th>LF %</th></tr>
        </thead>
        <tbody>
          {rows.filter((r) => r.data).map(({ label, data: d, hl }) => (
            <tr key={label} className={hl ? 'hl' : ''}>
              <td className="pname"><b>{label}</b></td>
              <td>{n0(d.gp)}</td><td>{f1(d.min)}</td><td className="hi"><b>{f1(d.pts)}</b></td><td>{f1(d.reb)}</td><td>{f1(d.ast)}</td>
              <td>{f1(d.stl)}</td><td>{f1(d.blk)}</td><td>{f1(d.tov)}</td><td>{f1(d.fgPct)}</td><td>{f1(d.tpPct)}</td><td>{f1(d.ftPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fiche d'un joueur suivi. */
export default function Player({ id }) {
  const { data, error, loading } = useData(() => loadPlayers(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const p = data.players.find((x) => x.id === id);
  if (!p) return <ErrorState error={new Error('Joueur introuvable')} />;
  const games = p.last5.games;

  return (
    <div className="page">
      <a className="back" href={href('joueurs', 'suivis')}>← Mes joueurs</a>

      <header className="card player-head">
        <div className="ph-photo">{p.headshot && <img src={p.headshot} alt="" />}</div>
        <div className="ph-info">
          <p className="kicker">{p.teamName}{p.jersey ? ` · #${p.jersey}` : ''}</p>
          <h1>{p.name}</h1>
          <p className="muted small">
            {[posLabel(p.position), p.age && `${p.age} ans`, p.height, expLabel(p.experience)].filter(Boolean).join(' · ')}
          </p>
          {p.injury && <span className="inj">{injuryLabel(p.injury.status)}</span>}
        </div>
        <TeamLogo team={{ logo: p.logo, abbr: p.team }} size={52} />
      </header>

      <h2 className="section-title">Moyennes {p.season?.season || 'de la saison'}</h2>
      <div className="stat-tiles">
        {[['pts', 'Points'], ['reb', 'Rebonds'], ['ast', 'Passes déc.']].map(([k, label]) => (
          <div key={k} className="card tile">
            <span className="muted small">{label}</span>
            <b>{f1(p.season?.[k])}</b>
            <span className="small">5 der. : <b>{f1(p.last5.avg?.[k])}</b></span>
          </div>
        ))}
      </div>
      <AvgTable rows={[
        { label: 'Saison', data: p.season, hl: true },
        { label: '5 derniers', data: p.last5.avg },
        { label: 'Carrière', data: p.career },
      ]} />

      {games.length > 0 && (
        <>
          <h2 className="section-title">5 derniers matches</h2>
          <div className="table-wrap">
            <table className="box">
              <thead>
                <tr><th className="pname">Match</th><th>MIN</th><th>PTS</th><th>REB</th><th>PD</th><th>INT</th><th>CTR</th><th>BP</th><th>TIRS</th><th>3PTS</th><th>LF</th></tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td className="pname gl-match">
                      <span className="gl-top">
                        <span className="muted">{gameDay(g.date)}</span>
                        <span className="muted">{g.atVs === '@' ? '@' : 'vs'}</span>
                        <TeamLogo team={{ logo: g.oppLogo, abbr: g.opp }} size={16} />{g.opp}
                      </span>
                      <small><span className={g.result === 'W' ? 'win' : 'loss'}>{g.result === 'W' ? 'V' : 'D'}</span> {g.score}</small>
                    </td>
                    <td>{n0(g.min)}</td><td className="hi"><b>{n0(g.pts)}</b></td><td>{n0(g.reb)}</td><td>{n0(g.ast)}</td>
                    <td>{n0(g.stl)}</td><td>{n0(g.blk)}</td><td>{n0(g.tov)}</td>
                    <td>{g.fgm}-{g.fga}</td><td>{g.tpm}-{g.tpa}</td><td>{g.ftm}-{g.fta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="section-title">Saisons passées</h2>
      {p.past.length ? (
        <div className="table-wrap">
          <table className="box">
            <thead>
              <tr><th className="pname">Saison</th><th>Équipe</th><th>MJ</th><th>MIN</th><th>PTS</th><th>REB</th><th>PD</th><th>INT</th><th>CTR</th><th>TIRS %</th><th>3PTS %</th><th>LF %</th></tr>
            </thead>
            <tbody>
              {p.past.map((r, i) => (
                <tr key={`${r.season}-${r.team}-${i}`}>
                  <td className="pname"><b>{r.season}</b></td>
                  <td><span className="st-team"><TeamLogo team={{ logo: r.logo, abbr: r.team }} size={16} />{r.team}</span></td>
                  <td>{n0(r.gp)}</td><td>{f1(r.min)}</td><td className="hi"><b>{f1(r.pts)}</b></td><td>{f1(r.reb)}</td><td>{f1(r.ast)}</td>
                  <td>{f1(r.stl)}</td><td>{f1(r.blk)}</td><td>{f1(r.fgPct)}</td><td>{f1(r.tpPct)}</td><td>{f1(r.ftPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">Première saison en NBA.</p>}
      <p className="muted small">Saison régulière uniquement. MJ : matches joués · PD : passes décisives · INT : interceptions · CTR : contres · BP : balles perdues · LF : lancers francs.</p>
    </div>
  );
}
