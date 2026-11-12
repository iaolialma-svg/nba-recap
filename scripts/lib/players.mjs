// Fiches des joueurs suivis (scripts/players.json) : moyennes de la saison,
// 5 derniers matches et moyennes des saisons passées. Source : API publique ESPN.
import { getJson } from './espn.mjs';

const ATH = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes';
const logoOf = (abbr) => (abbr ? `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png` : null);
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const round1 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);

/** "8.0-16.0" -> [8, 16] */
const pair = (v) => String(v ?? '').split('-').map(Number);

/** Ligne de moyennes ESPN (catégorie "averages") -> objet lisible. */
function averagesRow(names, stats) {
  const g = (n) => stats[names.indexOf(n)];
  return {
    gp: num(g('gamesPlayed')),
    min: num(g('avgMinutes')),
    pts: num(g('avgPoints')),
    reb: num(g('avgRebounds')),
    ast: num(g('avgAssists')),
    stl: num(g('avgSteals')),
    blk: num(g('avgBlocks')),
    tov: num(g('avgTurnovers')),
    fgPct: num(g('fieldGoalPct')),
    tpPct: num(g('threePointFieldGoalPct')),
    ftPct: num(g('freeThrowPct')),
  };
}

/** Moyenne pondérée par les matches joués (saison partagée entre deux équipes). */
function mergeRows(rows) {
  if (rows.length === 1) return rows[0];
  const gp = rows.reduce((s, r) => s + (r.gp || 0), 0);
  const out = { gp };
  for (const k of ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgPct', 'tpPct', 'ftPct']) {
    out[k] = round1(rows.reduce((s, r) => s + (r[k] || 0) * (r.gp || 0), 0) / (gp || 1));
  }
  return out;
}

async function buildPlayer(id) {
  const [profile, stats, log] = await Promise.all([
    getJson(`${ATH}/${id}`),
    getJson(`${ATH}/${id}/stats`),
    getJson(`${ATH}/${id}/gamelog`).catch(() => null),
  ]);
  const a = profile.athlete || profile;
  const teamAbbr = a.team?.abbreviation || '';

  // ------------------------------------------------ Saisons (régulières)
  const teamsById = Object.fromEntries(Object.values(stats.teams || {}).map((t) => [String(t.id), t]));
  const avg = stats.categories?.find((c) => c.name === 'averages');
  const rows = (avg?.statistics || []).map((s) => {
    const t = teamsById[String(s.teamId)];
    return {
      year: s.season?.year,
      season: s.season?.displayName,
      team: t?.abbreviation || '',
      logo: logoOf(t?.abbreviation),
      ...averagesRow(avg.names, s.stats),
    };
  });
  const currentYear = Math.max(0, ...rows.map((r) => r.year || 0));
  const seasonFromLog = log?.seasonTypes?.find((s) => /Regular Season/i.test(s.displayName));
  const logYear = seasonFromLog ? Number(seasonFromLog.displayName.slice(0, 4)) + 1 : null;
  const thisYear = logYear || currentYear;
  const currentRows = rows.filter((r) => r.year === thisYear);
  const season = currentRows.length ? { ...mergeRows(currentRows), season: currentRows[0].season } : null;
  const past = rows.filter((r) => r.year && r.year < thisYear).sort((x, y) => y.year - x.year);
  const career = avg?.totals ? averagesRow(avg.names, avg.totals) : null;

  // ------------------------------------------------ 5 derniers matches de saison régulière
  const names = log?.names || [];
  const games = [];
  for (const cat of seasonFromLog?.categories || []) {
    for (const ev of cat.events || []) {
      const meta = log.events?.[ev.eventId];
      if (!meta) continue;
      const g = (n) => ev.stats[names.indexOf(n)];
      const [fgm, fga] = pair(g('fieldGoalsMade-fieldGoalsAttempted'));
      const [tpm, tpa] = pair(g('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
      const [ftm, fta] = pair(g('freeThrowsMade-freeThrowsAttempted'));
      games.push({
        id: String(ev.eventId),
        date: meta.gameDate,
        opp: meta.opponent?.abbreviation || '',
        oppLogo: meta.opponent?.logo || logoOf(meta.opponent?.abbreviation),
        atVs: meta.atVs,
        result: meta.gameResult,
        score: meta.score,
        min: num(g('minutes')),
        pts: num(g('points')),
        reb: num(g('totalRebounds')),
        ast: num(g('assists')),
        stl: num(g('steals')),
        blk: num(g('blocks')),
        tov: num(g('turnovers')),
        fgm, fga, tpm, tpa, ftm, fta,
      });
    }
  }
  games.sort((x, y) => new Date(y.date) - new Date(x.date));
  const last = games.slice(0, 5);
  let lastAvg = null;
  if (last.length) {
    const sum = (k) => last.reduce((s, x) => s + (x[k] || 0), 0);
    const pct = (m, t) => (sum(t) ? round1((100 * sum(m)) / sum(t)) : null);
    lastAvg = {
      gp: last.length,
      min: round1(sum('min') / last.length),
      pts: round1(sum('pts') / last.length),
      reb: round1(sum('reb') / last.length),
      ast: round1(sum('ast') / last.length),
      stl: round1(sum('stl') / last.length),
      blk: round1(sum('blk') / last.length),
      tov: round1(sum('tov') / last.length),
      fgPct: pct('fgm', 'fga'),
      tpPct: pct('tpm', 'tpa'),
      ftPct: pct('ftm', 'fta'),
    };
  }

  const injury = a.injuries?.[0];
  return {
    id: String(a.id),
    name: a.displayName,
    team: teamAbbr,
    teamName: a.team?.displayName || '',
    logo: logoOf(teamAbbr),
    headshot: a.headshot?.href || null,
    position: a.position?.displayName || '',
    jersey: a.jersey || '',
    age: a.age || null,
    height: a.displayHeight || '',
    experience: a.displayExperience || '',
    injury: injury ? { status: injury.status || injury.type?.description || '', date: injury.date || null } : null,
    season,
    last5: { avg: lastAvg, games: last },
    past,
    career,
  };
}

/**
 * @param {string[]} ids identifiants ESPN
 * @param {object} [previous] players.json précédent : on garde l'ancienne fiche si un joueur échoue.
 */
export async function buildPlayers(ids, previous) {
  const prev = Object.fromEntries((previous?.players || []).map((p) => [p.id, p]));
  const players = [];
  for (const id of ids) {
    try {
      players.push(await buildPlayer(id));
    } catch (err) {
      console.log(`    ! joueur ${id} indisponible (${err.message})`);
      if (prev[id]) players.push(prev[id]);
    }
  }
  return { generatedAt: new Date().toISOString(), players };
}
