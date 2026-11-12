// Classements individuels de la saison régulière (moyennes par match).
// Source : API publique ESPN. Seuls les joueurs "qualifiés" selon ESPN sont retenus
// (assez de matches joués), pour éviter qu'un joueur à 1 match fausse le top.
const BY_ATHLETE = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete';
const CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons';

const TOP = 5;

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'nba-recap/0.1' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

/** Exécute `fn` sur chaque élément, `n` à la fois. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]).catch(() => null);
    }
  }));
  return out;
}

const round1 = (x) => Math.round(x * 10) / 10;

/**
 * @param {object} [previous] leaders.json précédent : sert de secours pour le +/- si l'API échoue.
 */
export async function buildLeaders(previous) {
  const url = `${BY_ATHLETE}?region=us&lang=en&contentorigin=espn&isqualified=true&limit=1000&sort=offensive.avgPoints%3Adesc`;
  const data = await getJson(url);
  const season = data.requestedSeason || data.currentSeason || {};
  const idx = {};
  for (const c of data.categories || []) idx[c.name] = Object.fromEntries(c.names.map((n, i) => [n, i]));
  const val = (a, cat, name) => {
    const c = a.categories?.find((x) => x.name === cat);
    const v = c?.values?.[idx[cat]?.[name]];
    return typeof v === 'number' ? v : Number(v);
  };

  const players = (data.athletes || []).map((a) => {
    const p = a.athlete;
    return {
      id: String(p.id),
      name: p.displayName,
      short: p.shortName,
      team: p.teamShortName || p.teams?.[0]?.abbreviation || '',
      teamId: String(p.teamId || p.teams?.[0]?.id || ''),
      logo: p.teamLogos?.[0]?.href || p.teams?.[0]?.logos?.[0]?.href || null,
      headshot: p.headshot?.href || null,
      position: p.position?.abbreviation || '',
      gp: val(a, 'general', 'gamesPlayed'),
      pts: val(a, 'offensive', 'avgPoints'),
      ast: val(a, 'offensive', 'avgAssists'),
      reb: val(a, 'general', 'avgRebounds'),
      blk: val(a, 'defensive', 'avgBlocks'),
    };
  }).filter((p) => p.gp > 0);

  const top = (key) => [...players]
    .filter((p) => Number.isFinite(p[key]))
    .sort((a, b) => b[key] - a[key])
    .slice(0, TOP)
    .map((p) => ({ ...pick(p), value: round1(p[key]) }));

  const categories = [
    { key: 'pts', label: 'Points', unit: 'pts/match', players: top('pts') },
    { key: 'ast', label: 'Passes décisives', unit: 'passes/match', players: top('ast') },
    { key: 'reb', label: 'Rebonds', unit: 'rebonds/match', players: top('reb') },
    { key: 'blk', label: 'Contres', unit: 'contres/match', players: top('blk') },
  ];

  // +/- : ESPN ne le donne qu'en total, joueur par joueur. On divise par les matches joués.
  const year = season.year;
  const type = season.type?.type || 2;
  let pm = null;
  if (year) {
    const stats = await pool(players, 12, (p) => getJson(`${CORE}/${year}/types/${type}/athletes/${p.id}/statistics/0`, 2));
    const rows = [];
    stats.forEach((s, i) => {
      const general = s?.splits?.categories?.find((c) => c.name === 'general')?.stats || [];
      const total = general.find((x) => x.name === 'plusMinus')?.value;
      const gp = general.find((x) => x.name === 'gamesPlayed')?.value;
      if (Number.isFinite(total) && gp > 0) rows.push({ ...pick(players[i]), gp, total, value: round1(total / gp) });
    });
    // Si trop d'appels ont échoué, le classement serait faux : on garde le précédent.
    if (rows.length >= players.length * 0.8) {
      pm = rows.sort((a, b) => b.value - a.value || b.total - a.total).slice(0, TOP);
    }
  }
  const prevPm = previous?.categories?.find((c) => c.key === 'pm')?.players;
  if (pm || prevPm) {
    categories.push({ key: 'pm', label: '+/- sur le terrain', unit: 'par match', signed: true, players: pm || prevPm });
  }

  return {
    generatedAt: new Date().toISOString(),
    season: season.displayName || null,
    qualified: players.length,
    categories,
  };
}

function pick(p) {
  return { id: p.id, name: p.name, short: p.short, team: p.team, teamId: p.teamId, logo: p.logo, headshot: p.headshot, position: p.position, gp: p.gp };
}
