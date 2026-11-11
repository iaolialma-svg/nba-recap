// Rédaction des résumés et articles en français avec l'API Claude.
// Sans clé ANTHROPIC_API_KEY, le pipeline retombe sur les résumés automatiques.
import Anthropic from '@anthropic-ai/sdk';
import { statLine } from './analyze.mjs';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'low';

let client = null;
export function aiEnabled() {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  client ??= new Anthropic();
  return true;
}

const SYSTEM = `Tu es journaliste NBA pour un média francophone. Tu écris en français naturel, vivant et précis, avec le vocabulaire basket courant en France (panier à 3 points, rebond, passe décisive, contre, interception, quart-temps, prolongation, banc, meneur, ailier, pivot…).
Règles : n'invente AUCUN fait, chiffre, blessure, citation ou contexte qui ne figure pas dans les données fournies. Si une info manque, n'en parle pas. Les scores s'écrivent vainqueur-perdant (ex. 117-85). Pas d'emoji.`;

async function askJson(prompt, schema, maxTokens = 8000) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: SYSTEM,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') throw new Error(`refus du modèle (${response.stop_details?.category ?? 'inconnu'})`);
  if (response.stop_reason === 'max_tokens') throw new Error('réponse tronquée (max_tokens)');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// ---------------------------------------------------------------- Résumé de match

const RECAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'text', 'keyFacts', 'turningPoint', 'performers'],
  properties: {
    title: { type: 'string', description: 'Titre accrocheur, 12 mots max' },
    text: { type: 'string', description: 'Résumé du match en 2 paragraphes (séparés par une ligne vide), 120 à 180 mots' },
    keyFacts: { type: 'array', items: { type: 'string' }, description: '3 à 5 faits de jeu marquants, une phrase chacun' },
    turningPoint: { type: 'string', description: 'Le tournant du match en 1 ou 2 phrases' },
    performers: {
      type: 'array',
      description: 'Les 3 joueurs qui ont le plus pesé (toutes équipes)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'team', 'line', 'note'],
        properties: {
          name: { type: 'string' },
          team: { type: 'string', description: 'Abréviation de l\'équipe' },
          line: { type: 'string', description: 'Ligne de stats, ex. "32 pts, 8 rbds, 6 pds, 12/20 aux tirs"' },
          note: { type: 'string', description: 'Une courte phrase sur son impact' },
        },
      },
    },
  },
};

function compactGame(game) {
  const side = (s) => {
    const t = game[s];
    return {
      equipe: t.name, abr: t.abbr, score: t.score, bilan: t.record, quarts: t.linescores,
      classement: game.form[s]?.standing ? `${game.form[s].standing.seed}e à l'${game.form[s].standing.conf}` : null,
      serie: game.form[s]?.standing?.streak || null,
      cinqDerniers: (game.form[s]?.last5 || []).map((g) => `${g.won ? 'V' : 'D'} ${g.home ? 'vs' : '@'} ${g.opp} ${g.score}`),
      statsEquipe: game.teamStats[s],
      joueurs: (game.players[s] || []).filter((p) => !p.dnp).sort((a, b) => b.gameScore - a.gameScore).slice(0, 7)
        .map((p) => `${p.name} (${p.pos}${p.starter ? ', titulaire' : ', banc'}) : ${statLine(p)}, ${p.min} min, +/- ${p.pm}, ${p.to} bp${p.tags.length ? ' [' + p.tags.join(', ') + ']' : ''}`),
      absents: (game.players[s] || []).filter((p) => p.dnp && p.reason).map((p) => `${p.name} (${p.reason})`),
    };
  };
  return {
    domicile: side('home'),
    exterieur: side('away'),
    deroule: game.flow,
    quartDecisif: game.decisiveQuarter,
    prolongations: Math.max(0, game.home.linescores.length - 4),
  };
}

export async function writeRecap(game) {
  const prompt = `Voici les données d'un match NBA de la nuit (${game.away.name} à ${game.home.name}). Les scores dans "deroule" sont au format exterieur-domicile.
Rédige le résumé du match : titre, résumé, faits de jeu marquants, tournant du match et joueurs qui ont performé.

${JSON.stringify(compactGame(game))}`;
  const out = await askJson(prompt, RECAP_SCHEMA);
  return { source: 'ia', ...out };
}

// ---------------------------------------------------------------- Articles de la page d'accueil

const ARTICLES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['articles'],
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'title', 'teaser', 'body', 'sourceIndex', 'gameId'],
        properties: {
          category: { type: 'string', enum: ['nuit', 'news'] },
          title: { type: 'string' },
          teaser: { type: 'string', description: 'Chapô d\'une phrase' },
          body: { type: 'string', description: '2 à 3 paragraphes séparés par une ligne vide' },
          sourceIndex: { type: 'integer', description: 'Index de la news source dans la liste fournie, ou -1 pour un article sur la nuit' },
          gameId: { type: 'string', description: 'id du match concerné pour un article "nuit", sinon chaîne vide' },
        },
      },
    },
  },
};

export async function writeArticles(games, news) {
  const night = games.map((g) => ({
    id: g.id,
    match: `${g.away.abbr} ${g.away.score} @ ${g.home.abbr} ${g.home.score}`,
    titre: g.recap?.title,
    resume: g.recap?.text,
  }));
  const sources = news.map((n, i) => ({ index: i, titre: n.headline, description: n.description, date: n.published }));
  const prompt = `Prépare la page d'accueil de l'appli.
1) Écris ${games.length ? '1 article "nuit" qui fait le tour de la nuit (sourceIndex -1, gameId vide) puis 1 à 2 articles "nuit" sur les matches les plus marquants (gameId renseigné)' : 'aucun article "nuit" (pas de match cette nuit)'}.
2) Écris 4 à 6 articles "news" à partir des news ESPN ci-dessous (en anglais) : choisis les plus intéressantes pour un fan français, ignore les doublons et les simples vidéos d'opinion. Reformule entièrement en français avec tes propres mots, en t'appuyant uniquement sur le titre et la description fournis : article court (2 paragraphes max), sans extrapoler.

Matches de la nuit :
${JSON.stringify(night)}

News ESPN :
${JSON.stringify(sources)}`;
  const out = await askJson(prompt, ARTICLES_SCHEMA, 16000);
  return out.articles;
}
