#!/usr/bin/env node
// Mise à jour quotidienne : récupère la nuit NBA, analyse, rédige et écrit les JSON
// lus par l'appli (public/data/). Usage :
//   node scripts/update.mjs                 -> nuit dernière
//   node scripts/update.mjs --date=2026-11-10   -> date US précise
//   node scripts/update.mjs --no-ai         -> sans l'API Claude
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchNews, fetchScoreboard, fetchStandings, fetchSummary, fetchTeamSchedule } from './lib/espn.mjs';
import {
  analyzePlays, decisiveQuarter, lastGames, parseBoxscore, parseStandings, ruleBasedRecap, teamFromCompetitor,
} from './lib/analyze.mjs';
import { aiEnabled, writeArticles, writeRecap } from './lib/ai.mjs';
import { buildLeaders } from './lib/leaders.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const useAi = !('no-ai' in args) && aiEnabled();

/**
 * Date US des matches de "la nuit" : la veille, heure de New York.
 * Ex. lancé le 11 à 8 h 30 à Paris (2 h 30 à New York) ou à 20 h à Paris -> matches du 10.
 */
function nightDate() {
  if (args.date) return args.date;
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d); // YYYY-MM-DD
}

const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

async function main() {
  const date = nightDate();
  log(`Nuit NBA du ${date} — IA : ${useAi ? 'activée' : 'désactivée (résumés automatiques)'}`);

  const [board, standingsRaw, newsRaw] = await Promise.all([
    fetchScoreboard(date.replaceAll('-', '')),
    fetchStandings(),
    fetchNews(30).catch(() => ({ articles: [] })),
  ]);
  const standings = parseStandings(standingsRaw);
  // Si la nuit a déjà été traitée (2e passage du matin), on réutilise les textes IA déjà écrits.
  let previous = null;
  try { previous = JSON.parse(await readFile(join(DATA, 'days', `${date}.json`), 'utf8')); } catch { /* nouvelle nuit */ }
  const previousRecap = (id) => previous?.games?.find((g) => g.id === id && g.recap?.source === 'ia')?.recap;
  const scheduleCache = new Map();
  const schedule = (id) => {
    if (!scheduleCache.has(id)) scheduleCache.set(id, fetchTeamSchedule(id).catch(() => null));
    return scheduleCache.get(id);
  };

  const games = [];
  for (const ev of board.events || []) {
    const comp = ev.competitions[0];
    const home = teamFromCompetitor(comp.competitors.find((c) => c.homeAway === 'home'));
    const away = teamFromCompetitor(comp.competitors.find((c) => c.homeAway === 'away'));
    const status = ev.status?.type || {};
    const game = {
      id: String(ev.id),
      date: ev.date,
      status: status.completed ? 'final' : status.state === 'in' ? 'live' : status.name === 'STATUS_POSTPONED' ? 'postponed' : 'scheduled',
      statusText: status.shortDetail || status.detail || '',
      venue: comp.venue?.fullName || null,
      home, away,
    };
    if (game.status !== 'final') {
      games.push(game);
      continue;
    }
    log(`  ${away.abbr} ${away.score} @ ${home.abbr} ${home.score}`);
    const summary = await fetchSummary(game.id);
    const box = parseBoxscore(summary);
    game.players = { home: box.players[home.id] || [], away: box.players[away.id] || [] };
    game.teamStats = { home: box.teamStats[home.id] || {}, away: box.teamStats[away.id] || {} };
    game.flow = analyzePlays(summary, home.id, away.id);
    game.decisiveQuarter = decisiveQuarter(home, away);
    const [hs, as] = await Promise.all([schedule(home.id), schedule(away.id)]);
    const cutoff = new Date(new Date(ev.date).getTime() + 6 * 3600 * 1000).toISOString();
    game.form = {
      home: { standing: standings.byTeam[home.id] || null, last5: lastGames(hs, home.id, cutoff) },
      away: { standing: standings.byTeam[away.id] || null, last5: lastGames(as, away.id, cutoff) },
    };
    game.recap = previousRecap(game.id) || ruleBasedRecap(game);
    if (useAi && game.recap.source !== 'ia') {
      try {
        game.recap = await writeRecap(game);
      } catch (err) {
        log(`    ! résumé IA indisponible (${err.message}) — résumé automatique conservé`);
      }
    }
    games.push(game);
  }

  // ------------------------------------------------ Articles de la page d'accueil
  const allNews = (newsRaw.articles || []).filter((a) => a.headline);
  const stories = [...allNews.filter((a) => a.type !== 'Media'), ...allNews.filter((a) => a.type === 'Media')].slice(0, 20);
  const finals = games.filter((g) => g.status === 'final');
  const newsMeta = (n) => ({
    image: n?.images?.[0]?.url || null,
    sourceUrl: n?.links?.web?.href || null,
    sourceName: 'ESPN',
    published: n?.published || null,
  });

  let articles = null;
  const prevFinals = previous?.games?.filter((g) => g.status === 'final').length;
  if (previous?.ai && prevFinals === finals.length && previous.articles?.some((a) => a.lang === 'fr' && a.category === 'news')) {
    articles = previous.articles;
  }
  if (useAi && !articles) {
    try {
      const written = await writeArticles(finals, stories);
      articles = written.map((a, i) => {
        const src = a.sourceIndex >= 0 ? stories[a.sourceIndex] : null;
        return {
          id: `${date}-${i}`,
          category: a.category,
          title: a.title,
          teaser: a.teaser,
          body: a.body,
          gameId: a.gameId || null,
          ...(src ? newsMeta(src) : { image: null, sourceUrl: null, sourceName: null, published: new Date().toISOString() }),
          lang: 'fr',
        };
      });
    } catch (err) {
      log(`  ! articles IA indisponibles (${err.message}) — articles automatiques`);
    }
  }
  if (!articles) {
    articles = [];
    if (finals.length) {
      articles.push({
        id: `${date}-nuit`,
        category: 'nuit',
        title: `La nuit NBA : ${finals.length} match${finals.length > 1 ? 's' : ''} au programme`,
        teaser: finals.map((g) => g.recap.title).slice(0, 2).join(' · '),
        body: finals.map((g) => `${g.recap.title}. ${g.recap.text}`).join('\n\n'),
        gameId: null, image: null, sourceUrl: null, sourceName: null, published: new Date().toISOString(), lang: 'fr',
      });
    }
    stories.slice(0, 8).forEach((n, i) => articles.push({
      id: `${date}-n${i}`, category: 'news', title: n.headline, teaser: n.description || '', body: n.description || '',
      gameId: null, ...newsMeta(n), lang: 'en',
    }));
  }

  // ------------------------------------------------ Écriture des fichiers
  const day = { date, generatedAt: new Date().toISOString(), ai: useAi, games, articles };
  await mkdir(join(DATA, 'days'), { recursive: true });
  await writeFile(join(DATA, 'days', `${date}.json`), JSON.stringify(day));
  await writeFile(join(DATA, 'latest.json'), JSON.stringify(day));
  await writeFile(join(DATA, 'standings.json'), JSON.stringify({ generatedAt: day.generatedAt, conferences: standings.conferences }));

  // Classements individuels (moyennes par match) : en cas d'échec on garde le fichier précédent.
  let prevLeaders = null;
  try { prevLeaders = JSON.parse(await readFile(join(DATA, 'leaders.json'), 'utf8')); } catch { /* premier lancement */ }
  try {
    const leaders = await buildLeaders(prevLeaders);
    await writeFile(join(DATA, 'leaders.json'), JSON.stringify(leaders));
    log(`  Leaders : ${leaders.qualified} joueurs qualifiés, ${leaders.categories.length} classements`);
  } catch (err) {
    log(`  ! leaders indisponibles (${err.message}) — fichier précédent conservé`);
  }

  let index = [];
  try { index = JSON.parse(await readFile(join(DATA, 'index.json'), 'utf8')).dates || []; } catch { /* premier lancement */ }
  index = [...new Set([date, ...index])].sort().reverse().slice(0, 90);
  await writeFile(join(DATA, 'index.json'), JSON.stringify({ latest: index[0], dates: index }));

  log(`OK : ${games.length} match(s), ${articles.length} article(s) -> public/data/days/${date}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
