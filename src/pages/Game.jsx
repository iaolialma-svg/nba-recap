import { useState } from 'react';
import { loadDay, loadStandings, useData } from '../api.js';
import { href } from '../router.js';
import { nightLabel, paragraphs, periodLabel } from '../format.js';
import { ErrorState, Loading, Tabs, TeamLogo } from '../components/ui.jsx';

const TABS = [
  { key: 'resume', label: 'Résumé' },
  { key: 'stats', label: 'Stats joueurs' },
  { key: 'forme', label: 'Classement & forme' },
];

export default function Game({ date, id, tab = 'resume' }) {
  const { data, error, loading } = useData(() => loadDay(date), [date]);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const game = data.games.find((g) => g.id === id);
  if (!game) return <div className="state">Match introuvable. <a href={href('resultats', date)}>Retour aux résultats</a></div>;

  return (
    <div className="page game">
      <a className="back" href={href('resultats', data.date)}>← {nightLabel(data.date)}</a>
      <Scoreboard game={game} />
      <Tabs tabs={TABS} active={tab} base={['match', data.date, game.id]} />
      {tab === 'stats' ? <BoxScore game={game} /> : tab === 'forme' ? <Form game={game} /> : <Recap game={game} />}
    </div>
  );
}

// ---------------------------------------------------------------- En-tête

function Scoreboard({ game }) {
  const { home, away } = game;
  const side = (t, label) => (
    <div className={`sb-team ${t.winner ? 'win' : ''}`}>
      <TeamLogo team={t} size={64} />
      <span className="sb-name">{t.shortName}</span>
      <span className="sb-rec">{t.record} · {label}</span>
    </div>
  );
  return (
    <section className="scoreboard" style={{ '--c1': away.color, '--c2': home.color }}>
      <div className="sb-main">
        {side(away, 'ext.')}
        <div className="sb-score">
          <span className={away.winner ? 'win' : ''}>{away.score}</span>
          <span className="sb-sep">–</span>
          <span className={home.winner ? 'win' : ''}>{home.score}</span>
          <small>Final{home.linescores.length > 4 ? ' (prol.)' : ''}</small>
        </div>
        {side(home, 'dom.')}
      </div>
      <div className="table-wrap">
        <table className="quarters">
          <thead><tr><th />{home.linescores.map((_, i) => <th key={i}>{periodLabel(i)}</th>)}<th>Total</th></tr></thead>
          <tbody>
            {[away, home].map((t) => (
              <tr key={t.id}><td>{t.abbr}</td>{t.linescores.map((v, i) => <td key={i}>{v}</td>)}<td><b>{t.score}</b></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Résumé

function Recap({ game }) {
  const r = game.recap;
  if (!r) return <div className="state">Résumé indisponible.</div>;
  const allPlayers = [...(game.players?.home || []), ...(game.players?.away || [])];
  const headshot = (name) => allPlayers.find((p) => p.name === name)?.headshot;

  return (
    <div className="recap">
      <h2>{r.title}</h2>
      {paragraphs(r.text).map((p, i) => <p key={i}>{p}</p>)}

      {r.turningPoint && (
        <div className="callout">
          <span className="callout-label">Le tournant du match</span>
          <p>{r.turningPoint}</p>
        </div>
      )}

      {r.keyFacts?.length > 0 && (
        <>
          <h3 className="section-title">Faits marquants</h3>
          <ul className="facts">{r.keyFacts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      )}

      {r.performers?.length > 0 && (
        <>
          <h3 className="section-title">Ils ont fait le match</h3>
          <div className="performers">
            {r.performers.map((p) => (
              <div className="perf" key={p.name}>
                {headshot(p.name) ? <img src={headshot(p.name)} alt="" loading="lazy" /> : <span className="perf-ph" />}
                <div>
                  <b>{p.name}</b> <span className="muted">{p.team}</span>
                  <div className="perf-line">{p.line}</div>
                  {p.note && <div className="muted small">{p.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <FlowStats game={game} />
      {r.source === 'auto' && <p className="footnote">Résumé généré automatiquement à partir des statistiques.</p>}
    </div>
  );
}

function FlowStats({ game }) {
  const f = game.flow;
  if (!f) return null;
  const name = (id) => (id === game.home.id ? game.home.abbr : game.away.abbr);
  const items = [];
  if (f.biggestRun) items.push(['Plus grosse série', `${f.biggestRun.points}-0 ${name(f.biggestRun.team)}`]);
  for (const t of [game.away, game.home]) {
    const l = f.largestLead[t.id];
    items.push([`Plus gros écart ${t.abbr}`, l ? `+${l.points}` : '—']);
  }
  items.push(['Changements de leader', f.leadChanges], ['Égalités', f.ties]);
  return (
    <>
      <h3 className="section-title">Le match en chiffres</h3>
      <div className="kpis">{items.map(([k, v]) => <div className="kpi" key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    </>
  );
}

// ---------------------------------------------------------------- Stats joueurs

const pct = (m, a) => (a ? Math.round((m / a) * 100) : 0);

function BoxScore({ game }) {
  const [side, setSide] = useState(game.away.winner ? 'away' : 'home');
  const team = game[side];
  const players = game.players?.[side] || [];
  const played = players.filter((p) => !p.dnp);
  const starters = played.filter((p) => p.starter);
  const bench = played.filter((p) => !p.starter);
  const dnp = players.filter((p) => p.dnp);
  const best = Math.max(...played.map((p) => p.pts), 0);

  const row = (p) => (
    <tr key={p.id}>
      <td className="pname"><span>{p.short || p.name}</span><small>{p.pos}</small></td>
      <td>{p.min}</td>
      <td className={p.pts === best ? 'hi' : ''}><b>{p.pts}</b></td>
      <td>{p.reb}</td><td>{p.ast}</td><td>{p.stl}</td><td>{p.blk}</td><td>{p.to}</td>
      <td>{p.fgm}/{p.fga}</td><td>{p.tpm}/{p.tpa}</td><td>{p.ftm}/{p.fta}</td>
      <td className={p.pm > 0 ? 'pos' : p.pm < 0 ? 'neg' : ''}>{p.pm > 0 ? '+' : ''}{p.pm}</td>
    </tr>
  );
  const head = (label) => (
    <tr className="group"><th className="pname">{label}</th><th>MIN</th><th>PTS</th><th>REB</th><th>PD</th><th>INT</th><th>CTR</th><th>BP</th><th>TIRS</th><th>3PTS</th><th>LF</th><th>+/-</th></tr>
  );

  return (
    <div>
      <div className="seg">
        {['away', 'home'].map((s) => (
          <button key={s} className={side === s ? 'active' : ''} onClick={() => setSide(s)}>
            <TeamLogo team={game[s]} size={20} />{game[s].shortName}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="box">
          <thead>{head('Titulaires')}</thead>
          <tbody>{starters.map(row)}</tbody>
          <thead>{head('Banc')}</thead>
          <tbody>{bench.map(row)}</tbody>
        </table>
      </div>
      {dnp.length > 0 && <p className="muted small dnp">N'ont pas joué : {dnp.map((p) => `${p.short || p.name}${p.reason ? ` (${p.reason.toLowerCase()})` : ''}`).join(', ')}</p>}
      <p className="muted small">PD : passes décisives · INT : interceptions · CTR : contres · BP : balles perdues · LF : lancers francs</p>
      <TeamCompare game={game} active={team} />
    </div>
  );
}

function TeamCompare({ game }) {
  const sum = (side, k) => (game.players?.[side] || []).reduce((s, p) => s + (p[k] || 0), 0);
  const ts = game.teamStats || {};
  const rows = [
    ['Adresse aux tirs', (s) => pct(sum(s, 'fgm'), sum(s, 'fga')), '%'],
    ['Adresse à 3 pts', (s) => pct(sum(s, 'tpm'), sum(s, 'tpa')), '%'],
    ['Lancers francs', (s) => pct(sum(s, 'ftm'), sum(s, 'fta')), '%'],
    ['Rebonds', (s) => sum(s, 'reb'), ''],
    ['Passes décisives', (s) => sum(s, 'ast'), ''],
    ['Balles perdues', (s) => sum(s, 'to'), ''],
    ['Points dans la raquette', (s) => parseInt(ts[s]?.['Points in Paint'], 10) || 0, ''],
    ['Contre-attaque', (s) => parseInt(ts[s]?.['Fast Break Points'], 10) || 0, ''],
  ];
  return (
    <>
      <h3 className="section-title">Duel d'équipes</h3>
      <div className="compare">
        <div className="cmp-head"><TeamLogo team={game.away} size={22} /><span /><TeamLogo team={game.home} size={22} /></div>
        {rows.map(([label, fn, unit]) => {
          const a = fn('away'), h = fn('home');
          const tot = a + h || 1;
          return (
            <div className="cmp-row" key={label}>
              <div className="cmp-vals"><b>{a}{unit}</b><span>{label}</span><b>{h}{unit}</b></div>
              <div className="cmp-bar">
                <i style={{ width: `${(a / tot) * 100}%`, background: game.away.color }} />
                <i style={{ width: `${(h / tot) * 100}%`, background: game.home.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Classement & forme

function Form({ game }) {
  const st = useData(() => loadStandings(), []);
  return (
    <div>
      <div className="form-grid">
        {['away', 'home'].map((s) => <TeamForm key={s} team={game[s]} form={game.form?.[s]} />)}
      </div>
      {st.data && <ConfTables standings={st.data} ids={[game.home.id, game.away.id]} />}
    </div>
  );
}

function TeamForm({ team, form }) {
  const s = form?.standing;
  return (
    <div className="card team-form">
      <div className="tf-head">
        <TeamLogo team={team} size={40} />
        <div><b>{team.name}</b>{s && <div className="muted small">{s.seed}e de la conférence {s.conf}</div>}</div>
      </div>
      {s && (
        <div className="kpis small-kpis">
          <div className="kpi"><span>Bilan</span><b>{s.wins}-{s.losses}</b></div>
          <div className="kpi"><span>Série</span><b>{s.streak?.replace('W', 'V').replace('L', 'D')}</b></div>
          <div className="kpi"><span>10 derniers</span><b>{s.lastTen}</b></div>
          <div className="kpi"><span>Domicile</span><b>{s.home}</b></div>
          <div className="kpi"><span>Extérieur</span><b>{s.road}</b></div>
          <div className="kpi"><span>Pts pour / contre</span><b>{s.ppg} / {s.oppg}</b></div>
        </div>
      )}
      <div className="last5-label muted small">5 derniers matches</div>
      <ul className="last5">
        {(form?.last5 || []).map((g, i) => (
          <li key={i}>
            <span className={`wl ${g.won ? 'w' : 'l'}`}>{g.won ? 'V' : 'D'}</span>
            <span className="muted">{g.home ? 'vs' : '@'}</span> {g.opp}
            <span className="l5-score">{g.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StandingsTable({ conf, highlight = [], compact = false }) {
  return (
    <div className="table-wrap">
      <table className="standings">
        <thead><tr><th>#</th><th className="pname">Équipe</th><th>V</th><th>D</th><th>%</th><th>Écart</th>{!compact && <><th>10 der.</th><th>Série</th></>}</tr></thead>
        <tbody>
          {conf.teams.map((t) => (
            <tr key={t.id} className={`${highlight.includes(t.id) ? 'hl' : ''} ${t.seed === 6 ? 'cut-po' : t.seed === 10 ? 'cut-pi' : ''}`}>
              <td>{t.seed}</td>
              <td className="pname"><span className="st-team"><TeamLogo team={t} size={20} />{t.shortName}</span></td>
              <td>{t.wins}</td><td>{t.losses}</td><td>{t.pct}</td><td>{t.gb}</td>
              {!compact && <><td>{t.lastTen}</td><td>{t.streak?.replace('W', 'V').replace('L', 'D')}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfTables({ standings, ids }) {
  const confs = standings.conferences.filter((c) => c.teams.some((t) => ids.includes(t.id)));
  return confs.map((c) => (
    <div key={c.name}>
      <h3 className="section-title">Conférence {c.name}</h3>
      <StandingsTable conf={c} highlight={ids} compact />
    </div>
  ));
}
