// Transforme les données brutes ESPN en modèle simple pour l'appli,
// et calcule les éléments factuels du match (runs, écarts, tournant, perfs…).

const int = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
const split = (v) => String(v || '0-0').split('-').map(int); // "14-22" -> [14, 22]

// ---------------------------------------------------------------- Équipes

export function teamFromCompetitor(c) {
  const t = c.team || {};
  return {
    id: String(t.id),
    abbr: t.abbreviation,
    name: t.displayName,
    shortName: t.shortDisplayName || t.name,
    city: t.location || t.shortDisplayName,
    logo: t.logo || (t.logos && t.logos[0] && t.logos[0].href) || null,
    color: t.color ? `#${t.color}` : '#555555',
    score: int(c.score && typeof c.score === 'object' ? c.score.value : c.score),
    record: (c.records || c.record || []).find((r) => r.type === 'total')?.summary || null,
    winner: !!c.winner,
    linescores: (c.linescores || []).map((l) => int(l.displayValue ?? l.value)),
  };
}

// ---------------------------------------------------------------- Joueurs

function playerRow(a, keys) {
  const s = Object.fromEntries(keys.map((k, i) => [k, a.stats?.[i]]));
  const [fgm, fga] = split(s['fieldGoalsMade-fieldGoalsAttempted']);
  const [tpm, tpa] = split(s['threePointFieldGoalsMade-threePointFieldGoalsAttempted']);
  const [ftm, fta] = split(s['freeThrowsMade-freeThrowsAttempted']);
  const p = {
    id: String(a.athlete?.id),
    name: a.athlete?.displayName,
    short: a.athlete?.shortName,
    pos: a.athlete?.position?.abbreviation || '',
    jersey: a.athlete?.jersey || '',
    headshot: a.athlete?.headshot?.href || null,
    starter: !!a.starter,
    dnp: !!a.didNotPlay || !a.stats || a.stats.length === 0,
    reason: a.didNotPlay ? a.reason || '' : '',
    min: int(s.minutes),
    pts: int(s.points),
    fgm, fga, tpm, tpa, ftm, fta,
    reb: int(s.rebounds),
    oreb: int(s.offensiveRebounds),
    dreb: int(s.defensiveRebounds),
    ast: int(s.assists),
    stl: int(s.steals),
    blk: int(s.blocks),
    to: int(s.turnovers),
    pf: int(s.fouls),
    pm: int(s.plusMinus),
  };
  // Game Score (John Hollinger) : indicateur synthétique de la perf d'un soir.
  p.gameScore = +(
    p.pts + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) + 0.7 * p.oreb + 0.3 * p.dreb +
    p.stl + 0.7 * p.ast + 0.7 * p.blk - 0.4 * p.pf - p.to
  ).toFixed(1);
  return p;
}

function notableLine(p) {
  const tens = [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length;
  const tags = [];
  if (tens >= 3) tags.push('triple-double');
  else if (tens === 2) tags.push('double-double');
  if (p.pts >= 40) tags.push(`${p.pts} points`);
  else if (p.pts >= 30) tags.push('30+ points');
  if (p.reb >= 15) tags.push(`${p.reb} rebonds`);
  if (p.ast >= 12) tags.push(`${p.ast} passes`);
  if (p.tpm >= 7) tags.push(`${p.tpm} paniers à 3 pts`);
  if (p.blk >= 5) tags.push(`${p.blk} contres`);
  if (p.stl >= 5) tags.push(`${p.stl} interceptions`);
  return tags;
}

export function parseBoxscore(summary) {
  const out = {};
  for (const team of summary.boxscore?.players || []) {
    const stat = team.statistics?.[0];
    if (!stat) continue;
    const players = (stat.athletes || []).map((a) => playerRow(a, stat.keys || []));
    players.forEach((p) => (p.tags = p.dnp ? [] : notableLine(p)));
    out[String(team.team.id)] = players;
  }
  const teamStats = {};
  for (const t of summary.boxscore?.teams || []) {
    teamStats[String(t.team.id)] = Object.fromEntries(
      (t.statistics || []).map((s) => [s.label, s.displayValue]),
    );
  }
  return { players: out, teamStats };
}

// ---------------------------------------------------------------- Play-by-play

const clockOf = (p) => `${p.period?.number > 4 ? `Prol. ${p.period.number - 4}` : `Q${p.period?.number}`} ${p.clock?.displayValue || ''}`.trim();

/**
 * Analyse le déroulé du match : plus grosse série, plus gros écarts,
 * changements de leader, situation avant le dernier quart.
 */
export function analyzePlays(summary, homeId, awayId) {
  const plays = (summary.plays || []).filter((p) => p.scoringPlay);
  const res = {
    leadChanges: 0,
    ties: 0,
    largestLead: { [homeId]: null, [awayId]: null },
    biggestRun: null,
    afterQ3: null,
    lastLeadChange: null,
  };
  if (!plays.length) return res;

  let prevHome = 0, prevAway = 0, prevSign = 0;
  let run = null;

  for (const p of plays) {
    const h = int(p.homeScore), a = int(p.awayScore);
    const dh = h - prevHome, da = a - prevAway;
    const scorer = dh > 0 ? homeId : da > 0 ? awayId : null;
    const pts = dh > 0 ? dh : da;

    // Séries (points consécutifs sans réponse)
    if (scorer) {
      if (run && run.team === scorer) {
        run.points += pts;
        run.end = { score: `${a}-${h}`, at: clockOf(p) };
      } else {
        run = { team: scorer, points: pts, start: { score: `${prevAway}-${prevHome}`, at: clockOf(p) }, end: { score: `${a}-${h}`, at: clockOf(p) } };
      }
      if (!res.biggestRun || run.points > res.biggestRun.points) res.biggestRun = { ...run, start: { ...run.start }, end: { ...run.end } };
    }

    // Écarts et changements de leader
    const margin = h - a;
    const sign = Math.sign(margin);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      res.leadChanges++;
      res.lastLeadChange = { at: clockOf(p), score: `${a}-${h}`, leader: sign > 0 ? homeId : awayId };
    }
    if (sign === 0 && prevSign !== 0) res.ties++;
    if (sign !== 0) prevSign = sign;
    const leader = margin > 0 ? homeId : awayId;
    const cur = res.largestLead[leader];
    if (margin !== 0 && (!cur || Math.abs(margin) > cur.points)) {
      res.largestLead[leader] = { points: Math.abs(margin), at: clockOf(p), score: `${a}-${h}` };
    }
    if (p.period?.number <= 3) res.afterQ3 = { away: a, home: h };

    prevHome = h; prevAway = a;
  }
  return res;
}

/** Quart-temps décisif : celui où le vainqueur a creusé le plus gros écart. */
export function decisiveQuarter(home, away) {
  const winner = home.score > away.score ? home : away;
  const loser = winner === home ? away : home;
  let best = null;
  winner.linescores.forEach((pts, i) => {
    const diff = pts - (loser.linescores[i] ?? 0);
    if (!best || diff > best.diff) best = { period: i + 1, diff, score: `${pts}-${loser.linescores[i] ?? 0}` };
  });
  return best && best.diff > 0 ? best : null;
}

// ---------------------------------------------------------------- Forme & classement

export function lastGames(schedule, teamId, beforeIso, n = 5) {
  const done = (schedule?.events || [])
    .filter((e) => e.competitions?.[0]?.status?.type?.completed && e.date <= beforeIso)
    .sort((x, y) => x.date.localeCompare(y.date));
  return done.slice(-n).reverse().map((e) => {
    const comp = e.competitions[0];
    const me = comp.competitors.find((c) => String(c.team.id) === teamId);
    const opp = comp.competitors.find((c) => String(c.team.id) !== teamId);
    const ms = int(me?.score?.value ?? me?.score?.displayValue ?? me?.score);
    const os = int(opp?.score?.value ?? opp?.score?.displayValue ?? opp?.score);
    return {
      date: e.date.slice(0, 10),
      opp: opp?.team?.abbreviation,
      oppLogo: opp?.team?.logos?.[0]?.href || null,
      home: me?.homeAway === 'home',
      won: ms > os,
      score: `${ms}-${os}`,
    };
  });
}

export function parseStandings(raw) {
  const confs = [];
  const byTeam = {};
  for (const child of raw.children || []) {
    const conf = child.name.startsWith('Eastern') ? 'Est' : 'Ouest';
    const rows = (child.standings?.entries || []).map((e) => {
      const s = Object.fromEntries((e.stats || []).map((x) => [x.name === 'Last Ten Games' || x.type === 'lasttengames' ? 'lastTen' : x.name, x]));
      const val = (k) => s[k]?.value;
      const disp = (k) => s[k]?.displayValue;
      const pick = (label) => (e.stats || []).find((x) => x.displayName === label || x.name === label)?.displayValue;
      return {
        id: String(e.team.id),
        abbr: e.team.abbreviation,
        name: e.team.displayName,
        shortName: e.team.shortDisplayName,
        logo: e.team.logos?.[0]?.href || null,
        conf,
        seed: val('playoffSeed') || 0,
        wins: val('wins') || 0,
        losses: val('losses') || 0,
        pct: disp('winPercent'),
        gb: disp('gamesBehind'),
        streak: disp('streak'),
        lastTen: pick('Last Ten Games') || pick('L10') || disp('lastTen'),
        home: pick('Home'),
        road: pick('Road'),
        ppg: disp('avgPointsFor'),
        oppg: disp('avgPointsAgainst'),
        diff: disp('differential'),
      };
    }).sort((a, b) => a.seed - b.seed);
    confs.push({ name: conf, teams: rows });
    rows.forEach((r) => (byTeam[r.id] = r));
  }
  return { conferences: confs, byTeam };
}

// ---------------------------------------------------------------- Résumé automatique (sans IA)

const pctLabel = (m, a) => (a ? `${m}/${a}` : '0/0');

export function topPerformers(game, n = 3) {
  const all = [];
  for (const side of ['home', 'away']) {
    for (const p of game.players[side] || []) if (!p.dnp) all.push({ ...p, team: game[side].abbr });
  }
  return all.sort((a, b) => b.gameScore - a.gameScore).slice(0, n);
}

export function statLine(p) {
  const parts = [`${p.pts} pts`, `${p.reb} rbds`, `${p.ast} pds`];
  if (p.stl >= 3) parts.push(`${p.stl} int`);
  if (p.blk >= 3) parts.push(`${p.blk} ctr`);
  parts.push(`${pctLabel(p.fgm, p.fga)} aux tirs`);
  if (p.tpa) parts.push(`${pctLabel(p.tpm, p.tpa)} à 3 pts`);
  return parts.join(', ');
}

/** Résumé de secours, généré par règles, si l'IA n'est pas disponible. */
export function ruleBasedRecap(game) {
  const { home, away, flow } = game;
  const w = home.score > away.score ? home : away;
  const l = w === home ? away : home;
  const margin = w.score - l.score;
  const tops = topPerformers(game, 3);
  const star = tops[0];
  const facts = [];

  const tone = margin >= 20 ? 'écrase' : margin >= 10 ? 'domine' : margin <= 3 ? "s'impose de justesse face à" : 'bat';
  const title = `${w.city} ${tone} ${l.city}${star ? `, ${star.name} décisif` : ''}`;

  if (flow.biggestRun && flow.biggestRun.points >= 8) {
    const t = flow.biggestRun.team === home.id ? home : away;
    facts.push(`Série de ${flow.biggestRun.points}-0 pour ${t.city} (${flow.biggestRun.start.at} → ${flow.biggestRun.end.at}).`);
  }
  const wl = flow.largestLead[w.id];
  if (wl) facts.push(`Plus gros écart : +${wl.points} pour ${w.city} (${wl.at}).`);
  const ll = flow.largestLead[l.id];
  if (ll && ll.points >= 8) facts.push(`${l.city} a pourtant mené de ${ll.points} points (${ll.at}).`);
  if (flow.leadChanges >= 8) facts.push(`Match serré : ${flow.leadChanges} changements de leader et ${flow.ties} égalités.`);
  for (const p of tops) if (p.tags?.length) facts.push(`${p.name} (${p.team}) : ${p.tags.join(', ')}.`);

  let turning = null;
  if (game.decisiveQuarter) {
    const q = game.decisiveQuarter;
    turning = `Le ${q.period > 4 ? 'temps supplémentaire' : `${q.period}${q.period === 1 ? 'er' : 'e'} quart-temps`}, remporté ${q.score} par ${w.city}, a fait basculer la rencontre.`;
  }
  const run = flow.biggestRun;
  if (run && run.team === w.id && run.points >= 10) {
    const [ra, rh] = run.start.score.split('-').map(Number);
    if (Math.abs(ra - rh) <= 10) turning = `Le tournant : une série de ${run.points}-0 signée ${w.city} entre ${run.start.at} et ${run.end.at} (de ${run.start.score} à ${run.end.score}, score extérieur-domicile).`;
  }
  if (flow.lastLeadChange && flow.lastLeadChange.leader === w.id && /Q4|Prol/.test(flow.lastLeadChange.at)) {
    turning = `${w.city} reprend définitivement les commandes à ${flow.lastLeadChange.at} (${flow.lastLeadChange.score}) et ne sera plus rejoint.`;
  }

  const text =
    `${w.name} ${tone} ${l.name} ${w.score}-${l.score}.` +
    (star ? ` ${star.name} a été le grand artisan de la soirée (${statLine(star)}).` : '') +
    (tops[1] ? ` ${tops[1].name} (${tops[1].team}) a également pesé avec ${statLine(tops[1])}.` : '');

  return {
    source: 'auto',
    title,
    text,
    keyFacts: facts.slice(0, 5),
    turningPoint: turning,
    performers: tops.map((p) => ({ name: p.name, team: p.team, line: statLine(p), note: p.tags?.join(', ') || '' })),
  };
}
