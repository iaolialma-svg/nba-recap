// Rédaction automatique en français, sans IA et sans coût.
// Tout part des statistiques du match : aucune phrase n'affirme un fait absent des données.
import { statLine, topPerformers } from './analyze.mjs';

// ---------------------------------------------------------------- Variété des formulations

const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** Choisit une formulation, sans la réutiliser tant que les autres n'ont pas servi dans la nuit. */
export function createVoice(seed) {
  const used = new Map();
  return (key, options) => {
    const seen = used.get(key) || new Set();
    if (seen.size >= options.length) seen.clear();
    const start = hash(`${seed}:${key}`) % options.length;
    for (let i = 0; i < options.length; i++) {
      const idx = (start + i) % options.length;
      if (!seen.has(idx)) {
        seen.add(idx);
        used.set(key, seen);
        return options[idx];
      }
    }
    return options[0];
  };
}

// ---------------------------------------------------------------- Grammaire

const CITY = {
  ATL: 'Atlanta', BOS: 'Boston', BKN: 'Brooklyn', CHA: 'Charlotte', CHI: 'Chicago', CLE: 'Cleveland', DAL: 'Dallas',
  DEN: 'Denver', DET: 'Detroit', GS: 'Golden State', HOU: 'Houston', IND: 'Indiana', MEM: 'Memphis', MIA: 'Miami',
  MIL: 'Milwaukee', MIN: 'Minnesota', NO: 'New Orleans', NY: 'New York', OKC: 'Oklahoma City', ORL: 'Orlando',
  PHI: 'Philadelphie', PHX: 'Phoenix', POR: 'Portland', SA: 'San Antonio', SAC: 'Sacramento', TOR: 'Toronto',
  UTAH: 'Utah', WSH: 'Washington',
};
const PLURAL = { LAL: 'Lakers', LAC: 'Clippers' };

/** Formes françaises d'une équipe : ville (singulier) ou "les Lakers" (pluriel). */
export function fr(team) {
  const nick = PLURAL[team.abbr];
  if (nick) {
    return { S: `Les ${nick}`, le: `les ${nick}`, de: `des ${nick}`, a: `aux ${nick}`, v: (_s, p) => p };
  }
  const c = CITY[team.abbr] || team.city || team.shortName;
  return { S: c, le: c, de: /^[AEIOUH]/.test(c) && !c.startsWith('Hou') ? `d'${c}` : `de ${c}`, a: `à ${c}`, v: (s) => s };
}

const dec = (x) => Number(x).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ord = (n) => (n === 1 ? '1er' : `${n}e`);
const ordF = (n) => (n === 1 ? '1re' : `${n}e`);
const plural = (n, w, ws = `${w}s`) => `${n} ${n > 1 ? ws : w}`;
const last = (name) => name.split(' ').slice(1).join(' ') || name;
const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const quarter = (i) => (i > 4 ? (i === 5 ? 'la prolongation' : `la ${i - 4}e prolongation`) : `le ${ord(i)} quart-temps`);

const isBuzzer = (at) => /\s0(?:[.:]0+)?$/.test(at || '');

/** "Q3 6:08" -> "à 6:08 de la fin du 3e quart-temps" */
function when(at) {
  const m = /^(?:Q(\d)|Prol\. (\d+)) (.+)$/.exec(at || '');
  if (!m) return '';
  if (isBuzzer(at)) return m[1] ? `au buzzer du ${ord(Number(m[1]))} quart-temps` : `au buzzer de ${m[2] === '1' ? 'la prolongation' : `la ${m[2]}e prolongation`}`;
  const clock = m[3].includes(':') ? m[3] : `${m[3].replace('.', ',')} s`;
  if (m[1]) return `à ${clock} de la fin du ${ord(Number(m[1]))} quart-temps`;
  return `à ${clock} de la fin de ${m[2] === '1' ? 'la prolongation' : `la ${m[2]}e prolongation`}`;
}

/** Résumé d'une ligne de stats : "31 points, 8 rebonds et 6 passes décisives". */
function perf(p) {
  const parts = [plural(p.pts, 'point')];
  if (p.reb >= 5) parts.push(plural(p.reb, 'rebond'));
  if (p.ast >= 4) parts.push(plural(p.ast, 'passe décisive', 'passes décisives'));
  if (p.stl >= 3) parts.push(plural(p.stl, 'interception'));
  if (p.blk >= 3) parts.push(plural(p.blk, 'contre'));
  return list(parts);
}

const shooting = (p) => {
  const bits = [`${p.fgm}/${p.fga} aux tirs`];
  if (p.tpm >= 3) bits.push(`dont ${p.tpm}/${p.tpa} à 3 points`);
  return bits.join(', ');
};

const isTripleDouble = (p) => [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length >= 3;

const avgNote = (p, averages) => {
  const a = averages?.[p.id];
  return a && a.gp >= 3 && p.pts - a.pts >= 8 ? `, loin de ses ${dec(a.pts)} points de moyenne cette saison` : '';
};

// ---------------------------------------------------------------- Lecture du match

const pct = (record) => {
  const [w, l] = String(record || '').split('-').map(Number);
  return w + l >= 8 ? w / (w + l) : null;
};
const pair = (v) => String(v || '0-0').split('-').map(Number);
const stat = (s, k) => Number(s?.[k]) || 0;
const active = (game, side) => (game.players?.[side] || []).filter((p) => !p.dnp);
const byScore = (a, b) => b.gameScore - a.gameScore;

/** Oriente un score "extérieur-domicile" avec l'équipe voulue en premier. */
const orient = (score, team, home) => {
  const [a, h] = score.split('-');
  return team.id === home.id ? `${h}-${a}` : `${a}-${h}`;
};

function read(game) {
  const { home, away, flow } = game;
  const w = home.score > away.score ? home : away;
  const l = w === home ? away : home;
  const wSide = w === home ? 'home' : 'away';
  const lSide = w === home ? 'away' : 'home';
  const wPlayers = active(game, wSide).sort(byScore);
  const lPlayers = active(game, lSide).sort(byScore);
  const lTop = [...lPlayers].sort((a, b) => b.pts - a.pts)[0];
  const margin = w.score - l.score;
  const deficit = flow?.largestLead?.[l.id]?.points || 0;
  const wLead = flow?.largestLead?.[w.id]?.points || 0;
  const pw = pct(w.record), pl = pct(l.record);
  let kind = 'default';
  if (lTop?.pts >= 40) kind = 'hero';
  else if (wPlayers[0] && isTripleDouble(wPlayers[0])) kind = 'triple';
  else if (wPlayers[0]?.pts >= 40) kind = 'forty';
  else if (w.linescores.length > 4) kind = 'ot';
  else if (deficit >= 12) kind = 'comeback';
  else if (pw !== null && pl !== null && pl - pw >= 0.25) kind = 'upset';
  else if (margin >= 20) kind = 'blowout';
  else if (margin <= 5 && wLead >= 15) kind = 'scare';
  else if (margin <= 4) kind = 'tight';
  else if (deficit <= 2 && margin >= 10) kind = 'wire';
  return { w, l, wSide, lSide, wPlayers, lPlayers, lTop, margin, deficit, wLead, kind, W: fr(w), L: fr(l) };
}

/** Le domaine statistique où le vainqueur a creusé l'écart. */
function edges(game, r) {
  const a = game.teamStats?.[r.wSide], b = game.teamStats?.[r.lSide];
  if (!a || !b) return [];
  const { W } = r;
  const out = [];
  const [w3, w3a] = pair(a['3PT']), [l3, l3a] = pair(b['3PT']);
  if (w3 - l3 >= 4) {
    out.push({ score: (w3 - l3) * 3, short: `${w3}/${w3a} à 3 points contre ${l3}/${l3a}`, text: `${W.S} ${W.v('a', 'ont')} fait mal de loin (${w3}/${w3a} à 3 points, contre ${l3}/${l3a} en face)` });
  }
  const paint = stat(a, 'Points in Paint') - stat(b, 'Points in Paint');
  if (paint >= 10) out.push({ score: paint, short: `${stat(a, 'Points in Paint')} points dans la raquette contre ${stat(b, 'Points in Paint')}`, text: `la raquette a penché du côté ${W.de} (${stat(a, 'Points in Paint')} points inscrits près du cercle, contre ${stat(b, 'Points in Paint')})` });
  const reb = stat(a, 'Rebounds') - stat(b, 'Rebounds');
  if (reb >= 8) out.push({ score: reb * 1.5, short: `${stat(a, 'Rebounds')} rebonds contre ${stat(b, 'Rebounds')}`, text: `la bataille du rebond a tourné à l'avantage ${W.de} (${stat(a, 'Rebounds')} à ${stat(b, 'Rebounds')})` });
  const tov = stat(b, 'Total Turnovers') - stat(a, 'Total Turnovers');
  if (tov >= 5) out.push({ score: tov * 2, short: `${stat(a, 'Total Turnovers')} balles perdues contre ${stat(b, 'Total Turnovers')}`, text: `la maîtrise du ballon a pesé (${stat(a, 'Total Turnovers')} balles perdues pour le vainqueur, ${stat(b, 'Total Turnovers')} pour le perdant)` });
  const fast = stat(a, 'Fast Break Points') - stat(b, 'Fast Break Points');
  if (fast >= 10) out.push({ score: fast, short: `${stat(a, 'Fast Break Points')} points en contre-attaque contre ${stat(b, 'Fast Break Points')}`, text: `le jeu de transition a fait la différence (${stat(a, 'Fast Break Points')} points en contre-attaque, contre ${stat(b, 'Fast Break Points')})` });
  const [wf, wfa] = pair(a.FT), [lf, lfa] = pair(b.FT);
  if (wf - lf >= 8) out.push({ score: wf - lf, short: `${wf}/${wfa} aux lancers francs contre ${lf}/${lfa}`, text: `la ligne des lancers francs a compté (${wf}/${wfa}, contre ${lf}/${lfa})` });
  const ast = stat(a, 'Assists') - stat(b, 'Assists');
  if (ast >= 8) out.push({ score: ast, short: `${stat(a, 'Assists')} passes décisives contre ${stat(b, 'Assists')}`, text: `le collectif a parlé (${stat(a, 'Assists')} passes décisives, contre ${stat(b, 'Assists')})` });
  return out.sort((x, y) => y.score - x.score);
}

/** Le classement n'est cité que s'il correspond bien au bilan de l'équipe après ce match. */
function standingOf(game, side) {
  const s = game.form?.[side]?.standing;
  if (!s || `${s.wins}-${s.losses}` !== game[side].record) return null;
  const m = /^([WL])(\d+)$/.exec(s.streak || '');
  return { seed: s.seed, conf: s.conf, streak: m ? Number(m[2]) : 0 };
}

// ---------------------------------------------------------------- Résumé d'un match

function title(r, say) {
  const { w, l, W, L, wPlayers, lTop, deficit, wLead, kind } = r;
  const star = wPlayers[0];
  const beat = `${W.S} ${W.v('bat', 'battent')} ${L.le}`;
  switch (kind) {
    case 'hero': return say('t-hero', [
      `Les ${lTop.pts} points de ${lTop.name} ne suffisent pas face ${W.a}`,
      `${lTop.name} flambe à ${lTop.pts} points, mais ${W.le} ${W.v("s'impose", "s'imposent")}`,
    ]);
    case 'triple': return say('t-triple', [`${star.name} en triple-double, ${beat}`, `Triple-double de ${star.name}, ${W.le} ${W.v("s'offre", "s'offrent")} ${L.le}`]);
    case 'forty': return say('t-forty', [`${star.name} explose à ${star.pts} points, ${beat}`, `${star.pts} points pour ${star.name}, ${W.le} ${W.v('fait', 'font')} plier ${L.le}`]);
    case 'ot': return say('t-ot', [`${W.S} ${W.v('arrache', 'arrachent')} la victoire en prolongation face ${L.a}`, `${W.S} ${W.v('fait', 'font')} craquer ${L.le} en prolongation`]);
    case 'comeback': return say('t-comeback', [`${W.S} ${W.v('renverse', 'renversent')} ${L.le} après ${deficit} points de retard`, `Mené de ${deficit} points, ${W.le} ${W.v('finit', 'finissent')} par battre ${L.le}`.replace('Mené', w.abbr in PLURAL ? 'Menés' : 'Mené')]);
    case 'upset': return say('t-upset', [`${W.S} ${W.v('crée', 'créent')} la surprise face ${L.a}`, `Coup d'éclat ${W.de} contre ${L.le}`]);
    case 'blowout': return say('t-blowout', [`${W.S} ${W.v('étrille', 'étrillent')} ${L.le}`, `${W.S} ${W.v('corrige', 'corrigent')} ${L.le}`, `Démonstration ${W.de} face ${L.a}`]);
    case 'scare': return say('t-scare', [`${W.S} ${W.v('tient', 'tiennent')} bon malgré le retour ${L.de}`, `${W.S} ${W.v('gâche', 'gâchent')} ${wLead} points d'avance mais ${W.v('gagne', 'gagnent')} quand même`]);
    case 'tight': return say('t-tight', [`${W.S} ${W.v("s'impose", "s'imposent")} sur le fil contre ${L.le}`, `${W.S} ${W.v('résiste', 'résistent')} ${L.a} dans un final serré`, `Victoire au courage ${W.de} face ${L.a}`]);
    case 'wire': return say('t-wire', [`${W.S} ${W.v('mène', 'mènent')} de bout en bout face ${L.a}`, `${W.S} ${W.v('contrôle', 'contrôlent')} ${L.le} sans trembler`]);
    default: return star
      ? say('t-default', [`${star.name} guide ${W.le} face ${L.a}`, `${W.S} ${W.v('domine', 'dominent')} ${L.le} avec un grand ${last(star.name)}`, `Porté par ${star.name}, ${W.le} ${W.v('bat', 'battent')} ${L.le}`.replace('Porté', w.abbr in PLURAL ? 'Portés' : 'Porté')])
      : `${beat} ${w.score}-${l.score}`;
  }
}

function lead(game, r, say) {
  const { w, l, W, L, margin, deficit, wLead, kind, lTop } = r;
  const score = `${w.score}-${l.score}`;
  const place = w === game.home ? 'à domicile' : `sur le parquet ${L.de}`;
  const ot = w.linescores.length > 4 ? (w.linescores.length === 5 ? ' après prolongation' : ` après ${w.linescores.length - 4} prolongations`) : '';
  const base = `${W.S} ${W.v("s'impose", "s'imposent")} ${score}${ot} ${place} face ${L.a}`.replace(` sur le parquet ${L.de} face ${L.a}`, ` sur le parquet ${L.de}`);
  switch (kind) {
    case 'hero': return `${base}, malgré la soirée exceptionnelle de ${lTop.name} : ${perf(lTop)} (${shooting(lTop)}).`;
    case 'comeback': return `${base}, après avoir compté jusqu'à ${deficit} points de retard.`;
    case 'blowout': return `${base}. Avec ${margin} points d'écart au coup de sifflet final, la rencontre n'a jamais vraiment eu de suspense.`;
    case 'scare': return `${base}, mais ${W.v('a', 'ont')} failli tout perdre après avoir compté jusqu'à ${wLead} points d'avance.`;
    case 'tight': return `${base}. ${cap(plural(margin, 'point'))} d'écart seulement au bout d'une rencontre indécise.`;
    case 'upset': return `${base} et crée la surprise : ${L.le} ${L.v('affichait', 'affichaient')} pourtant un bien meilleur bilan.`.replace('et crée', W.v('et crée', 'et créent'));
    case 'wire': return `${base}, sans jamais être réellement inquiété${w.abbr in PLURAL ? 's' : ''}.`;
    default: return `${base}${say('lead-end', ['.', ' au terme d\'une rencontre maîtrisée.', ' grâce à une belle soirée collective.'])}`.replace('..', '.');
  }
}

function story(game, r, say) {
  const { w, l, W, L, kind } = r;
  const { home, flow } = game;
  const out = [];
  const half = (t) => (t.linescores[0] || 0) + (t.linescores[1] || 0);
  const hw = half(w), hl = half(l);
  if (w.linescores.length >= 2) {
    if (hw === hl) out.push(`À la mi-temps, les deux équipes sont à égalité (${hw}-${hl}).`);
    else if (hw > hl) out.push(`À la pause, ${W.le} ${W.v('mène', 'mènent')} ${hw - hl >= 8 ? 'déjà ' : ''}${hw}-${hl}.`);
    else out.push(`À la pause, c'est ${L.le} qui ${L.v('mène', 'mènent')} ${hl}-${hw}.`);
  }
  const q = game.decisiveQuarter;
  if (q && q.diff >= 5) {
    out.push(say('quarter', [
      `Tout se joue dans ${quarter(q.period)}, remporté ${q.score} par ${W.le}.`,
      `${cap(quarter(q.period))}, gagné ${q.score}, fait pencher la balance du côté ${W.de}.`,
      `La différence se fait dans ${quarter(q.period)} (${q.score}).`,
    ]));
  }
  const run = flow?.biggestRun;
  if (run?.points >= 9) {
    const t = run.team === w.id ? w : l;
    const T = fr(t);
    out.push(`${T.S} ${T.v('signe', 'signent')} au passage une série de ${run.points}-0, ${when(run.end.at)}, pour passer de ${orient(run.start.score, t, home)} à ${orient(run.end.score, t, home)}.`);
  }
  if (flow?.leadChanges >= 8) {
    out.push(`La rencontre aura connu ${plural(flow.leadChanges, 'changement')} de leader et ${plural(flow.ties, 'égalité')}.`);
  }
  if ((kind === 'tight' || kind === 'scare') && flow?.finalLead?.leader === w.id) {
    out.push(`${W.S} ${W.v('passe', 'passent')} définitivement devant ${when(flow.finalLead.at)} (${orient(flow.finalLead.score, w, home)}).`);
  }
  return out.join(' ');
}

function playersPara(r, averages, say) {
  const { W, L, wPlayers, lPlayers, kind, lTop } = r;
  const [a, b] = wPlayers;
  const out = [];
  if (a) {
    out.push(say('star', [
      `${a.name} est l'homme fort ${W.de} avec ${perf(a)} (${shooting(a)})${avgNote(a, averages)}.`,
      `Côté vainqueur, ${a.name} montre la voie : ${perf(a)}, à ${shooting(a)}${avgNote(a, averages)}.`,
      `${a.name} signe la meilleure ligne ${W.de} : ${perf(a)} (${shooting(a)})${avgNote(a, averages)}.`,
    ]));
  }
  if (b && b.pts >= 12) out.push(say('second', [`${b.name} l'accompagne avec ${perf(b)}.`, `${b.name} apporte ${perf(b)}.`, `Bon soutien également de ${b.name} (${perf(b)}).`]));
  const bench = wPlayers.find((p) => !p.starter && p !== a && p !== b && p.pts >= 14);
  if (bench) out.push(`En sortie de banc, ${bench.name} ajoute ${perf(bench)}.`);
  const best = kind === 'hero' ? lPlayers.find((p) => p !== lTop) : lPlayers[0];
  if (best && best.pts >= 10) {
    out.push(say('loser', [
      `En face, ${best.name} termine avec ${perf(best)}, sans pouvoir inverser la tendance.`,
      `Du côté ${L.de}, ${best.name} a tenté de répondre (${perf(best)}).`,
      `${best.name} a été le plus en vue ${L.de} avec ${perf(best)}.`,
    ]));
  }
  return out.join(' ');
}

function outlook(game, r) {
  const { w, l, W, L, wSide, lSide } = r;
  const out = [];
  const sw = standingOf(game, wSide), sl = standingOf(game, lSide);
  if (w.record) {
    let s = `Avec ce succès, ${W.le} ${W.v('passe', 'passent')} à ${w.record}`;
    if (sw?.streak >= 2) s += `, ${W.v('signe', 'signent')} une ${ordF(sw.streak)} victoire de suite`;
    if (sw?.seed) s += ` et ${W.v('pointe', 'pointent')} à la ${ordF(sw.seed)} place à l'${sw.conf}`;
    out.push(`${s}.`);
  }
  if (l.record) {
    if (sl?.streak >= 3) out.push(`${L.S} ${L.v('concède', 'concèdent')} une ${ordF(sl.streak)} défaite d'affilée et ${L.v('tombe', 'tombent')} à ${l.record}.`);
    else out.push(`${L.S} ${L.v('recule', 'reculent')} à ${l.record}.`);
  }
  return out.join(' ');
}

function turning(game, r) {
  const { w, W, L } = r;
  const { home, flow } = game;
  const run = flow?.biggestRun;
  if (flow?.finalLead?.leader === w.id && /Q4|Prol/.test(flow.finalLead.at)) {
    if (isBuzzer(flow.finalLead.at)) return `${W.S} ${W.v('arrache', 'arrachent')} la victoire ${when(flow.finalLead.at)} (${orient(flow.finalLead.score, w, home)}).`;
    return `${W.S} ${W.v('prend', 'prennent')} l'avantage pour de bon ${when(flow.finalLead.at)} (${orient(flow.finalLead.score, w, home)}) et ${W.v('ne sera', 'ne seront')} plus ${w.abbr in PLURAL ? 'rejoints' : 'rejoint'}.`;
  }
  if (run && run.team === w.id && run.points >= 10) {
    const [x, y] = run.start.score.split('-').map(Number);
    if (Math.abs(x - y) <= 10) {
      return `Une série de ${run.points}-0 ${W.de}, conclue ${when(run.end.at)}, fait passer le score de ${orient(run.start.score, w, home)} à ${orient(run.end.score, w, home)}.`;
    }
  }
  const q = game.decisiveQuarter;
  if (q) return `${cap(quarter(q.period))}, remporté ${q.score} par ${W.le}, fait basculer la rencontre en défaveur ${L.de}.`;
  return null;
}

function facts(game, r, es) {
  const { w, l, W, L, deficit } = r;
  const { flow } = game;
  const out = [];
  const run = flow?.biggestRun;
  if (run?.points >= 8) {
    const T = fr(run.team === w.id ? w : l);
    out.push(`Plus grosse série : ${run.points}-0 pour ${T.le} (${when(run.end.at).replace(/^à /, 'conclue à ')}).`);
  }
  const wl = flow?.largestLead?.[w.id];
  if (wl) out.push(`Plus gros écart : +${wl.points} pour ${W.le}.`);
  if (deficit >= 8) out.push(`${L.S} ${L.v('a', 'ont')} pourtant mené de ${plural(deficit, 'point')}.`);
  if (flow?.leadChanges >= 8) out.push(`${plural(flow.leadChanges, 'changement')} de leader et ${plural(flow.ties, 'égalité')}.`);
  for (const e of es.slice(0, 2)) out.push(`Avantage ${W.de} : ${e.short}.`);
  for (const side of ['home', 'away']) {
    for (const p of active(game, side)) {
      if (isTripleDouble(p)) out.push(`Triple-double de ${p.name} : ${p.pts} points, ${p.reb} rebonds, ${p.ast} passes.`);
      if (p.tpm >= 7) out.push(`${p.name} : ${p.tpm} paniers à 3 points (${p.tpm}/${p.tpa}).`);
      if (p.blk >= 5) out.push(`${p.name} : ${p.blk} contres.`);
    }
  }
  return out.slice(0, 6);
}

/** Résumé complet d'un match, rédigé à partir des statistiques. */
export function autoRecap(game, { say = createVoice(game.id), averages = {} } = {}) {
  const r = read(game);
  const es = edges(game, r);
  const why = es[0] ? `${cap(es[0].text)}.` : '';
  const text = [
    `${lead(game, r, say)} ${story(game, r, say)}`.trim(),
    playersPara(r, averages, say),
    `${why} ${outlook(game, r)}`.trim(),
  ].filter(Boolean).join('\n\n');
  const tops = topPerformers(game, 3);
  return {
    source: 'auto',
    title: title(r, say),
    text,
    keyFacts: facts(game, r, es),
    turningPoint: turning(game, r),
    performers: tops.map((p) => {
      const a = averages[p.id];
      const notes = [...(p.tags || [])];
      if (a && a.gp >= 3 && p.pts - a.pts >= 8) notes.push(`+${dec(p.pts - a.pts)} pts par rapport à sa moyenne`);
      return { name: p.name, team: p.team, line: statLine(p), note: notes.join(' · ') };
    }),
  };
}

// ---------------------------------------------------------------- Articles de l'accueil

const nightPlayers = (games) => games.flatMap((g) => ['home', 'away'].flatMap((side) => active(g, side).map((p) => ({ ...p, game: g, teamObj: g[side], won: g[side].winner }))));

/** Intensité d'un match : final serré, prolongation, retournement, changements de leader. */
const drama = (g) => {
  const margin = Math.abs(g.home.score - g.away.score);
  const w = g.home.score > g.away.score ? g.home : g.away;
  const l = w === g.home ? g.away : g.home;
  return (30 - Math.min(margin, 30)) + (g.home.linescores.length > 4 ? 25 : 0)
    + (g.flow?.leadChanges || 0) + (g.flow?.largestLead?.[l.id]?.points || 0);
};

const shortLine = (p) => `${p.name} (${p.teamObj.abbr}) : ${perf(p)}`;

export function autoNightArticles(date, games, { followed = [] } = {}) {
  if (!games.length) return [];
  const articles = [];
  const add = (key, a) => articles.push({
    id: `${date}-${key}`, category: 'nuit', image: null, sourceUrl: null, sourceName: null,
    published: new Date().toISOString(), lang: 'fr', gameId: null, ...a,
  });
  const players = nightPlayers(games);
  const byGs = [...players].sort(byScore);
  const best = byGs[0];
  const ranked = [...games].sort((a, b) => drama(b) - drama(a));
  const top = ranked[0];

  // Le récap général
  const n = games.length;
  add('nuit', {
    gameId: top.id,
    title: top.recap.title,
    teaser: `${plural(n, 'match', 'matches')} cette nuit. ${best ? `Meilleure performance : ${best.name} (${perf(best)}).` : ''}`.trim(),
    body: [
      `Au programme de la nuit : ${plural(n, 'match', 'matches')}. Voici ce qu'il faut en retenir.`,
      ...games.map((g) => {
        const first = g.recap.text.split('\n\n')[0];
        return `${g.recap.title}. ${first}`;
      }),
    ].join('\n\n'),
  });

  // La performance de la nuit
  if (best) {
    const others = byGs.slice(1, 3).map((p) => `${p.name} (${perf(p)})`);
    add('perf', {
      gameId: best.game.id,
      title: `La perf de la nuit : ${best.name}, ${best.pts} points`,
      teaser: `${perf(best)} pour ${best.name}, ${best.won ? 'dans une victoire' : 'dans une défaite'} ${best.teamObj === best.game.home ? `face ${fr(best.game.away).a}` : `face ${fr(best.game.home).a}`}.`,
      body: [
        `${best.name} (${best.teamObj.name}) signe la meilleure performance de la nuit selon le Game Score, l'indice qui résume une ligne de statistiques en un seul chiffre : ${dec(best.gameScore)}.`,
        `Sa feuille de match : ${perf(best)}, à ${shooting(best)}, en ${best.min} minutes, avec un différentiel de ${best.pm > 0 ? '+' : ''}${best.pm} sur le terrain.`,
        others.length ? `Juste derrière : ${list(others)}.` : '',
      ].filter(Boolean).join('\n\n'),
    });
  }

  // Le match de la nuit (différent de celui de la perf si possible)
  const duel = ranked.find((g) => g.id !== best?.game.id) || top;
  if (n > 1) {
    add('match', {
      gameId: duel.id,
      title: `Le match à revoir : ${duel.away.shortName} - ${duel.home.shortName}`,
      teaser: duel.recap.title,
      body: [duel.recap.text, duel.recap.turningPoint ? `Le tournant : ${duel.recap.turningPoint}` : ''].filter(Boolean).join('\n\n'),
    });
  }

  // Top 5
  if (byGs.length >= 5) {
    add('top5', {
      title: 'Le top 5 de la nuit',
      teaser: byGs.slice(0, 3).map((p) => p.name).join(', ') + '…',
      body: byGs.slice(0, 5).map((p, i) => `${i + 1}. ${shortLine(p)}, à ${shooting(p)}.`).join('\n\n'),
    });
  }

  // Séries en cours
  const streaks = [];
  for (const g of games) {
    for (const side of ['home', 'away']) {
      const s = standingOf(g, side);
      if (s?.streak >= 4) streaks.push({ team: g[side], n: s.streak, won: g[side].winner });
    }
  }
  if (streaks.length) {
    streaks.sort((a, b) => b.n - a.n);
    const line = (x) => `${fr(x.team).S} : ${plural(x.n, x.won ? 'victoire' : 'défaite')} de suite (bilan ${x.team.record}).`;
    const hot = streaks.filter((x) => x.won), cold = streaks.filter((x) => !x.won);
    add('series', {
      title: hot[0] ? `${fr(hot[0].team).S} ${fr(hot[0].team).v('enchaîne', 'enchaînent')} : ${plural(hot[0].n, 'victoire')} de suite` : `${fr(cold[0].team).S} ${fr(cold[0].team).v('s\'enfonce', 's\'enfoncent')} : ${plural(cold[0].n, 'défaite')} de suite`,
      teaser: 'Les équipes en série après cette nuit.',
      body: [
        hot.length ? `Sur une bonne dynamique :\n\n${hot.map(line).join('\n\n')}` : '',
        cold.length ? `Dans le dur :\n\n${cold.map(line).join('\n\n')}` : '',
      ].filter(Boolean).join('\n\n'),
    });
  }

  // Mes joueurs
  const mine = players.filter((p) => followed.includes(p.id)).sort((a, b) => b.pts - a.pts);
  if (mine.length) {
    add('suivis', {
      title: `Mes joueurs cette nuit : ${mine[0].name} en tête`,
      teaser: mine.slice(0, 3).map((p) => `${last(p.name)} ${p.pts}`).join(' · '),
      body: mine.map((p) => `${shortLine(p)}, à ${shooting(p)} (${p.won ? 'victoire' : 'défaite'} ${p.teamObj.score}-${(p.teamObj === p.game.home ? p.game.away : p.game.home).score}).`).join('\n\n'),
    });
  }
  return articles;
}

// ---------------------------------------------------------------- Traduction gratuite des news

const MYMEMORY = 'https://api.mymemory.translated.net/get';

function decodeEntities(s) {
  return s.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/ /g, ' ');
}

/** Traduit un texte court en français ; renvoie null si le service gratuit refuse. */
async function translate(text) {
  if (!text || text.length > 480) return null;
  const url = `${MYMEMORY}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent('en|fr')}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'nba-recap/0.1' } });
  if (!res.ok) return null;
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  if (data?.quotaFinished || Number(data?.responseStatus) !== 200 || !out || /MYMEMORY WARNING|QUERY LENGTH/i.test(out)) return null;
  return decodeEntities(out);
}

/** News ESPN traduites. Si la traduction échoue, l'article reste en anglais. */
export async function autoNews(date, stories, newsMeta, previous) {
  const known = new Map((previous?.articles || []).filter((a) => a.translated && a.sourceUrl).map((a) => [a.sourceUrl, a]));
  const out = [];
  let stopped = false;
  for (const [i, n] of stories.slice(0, 8).entries()) {
    const meta = newsMeta(n);
    const description = n.description || '';
    const base = { id: `${date}-n${i}`, category: 'news', gameId: null, ...meta };
    const old = meta.sourceUrl && known.get(meta.sourceUrl);
    if (old) {
      out.push({ ...base, title: old.title, teaser: old.teaser, body: old.body, lang: 'fr', translated: true });
      continue;
    }
    let t = null, d = null;
    if (!stopped) {
      try {
        t = await translate(n.headline);
        d = description ? await translate(description) : '';
      } catch { /* service indisponible */ }
      if (t === null || d === null) stopped = true;
    }
    if (t !== null && d !== null) out.push({ ...base, title: t, teaser: d, body: d, lang: 'fr', translated: true });
    else out.push({ ...base, title: n.headline, teaser: description, body: description, lang: 'en' });
  }
  return out;
}
