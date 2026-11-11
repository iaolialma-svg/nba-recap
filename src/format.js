// Mise en forme (dates, libellés) en français.
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "2026-11-10" (date US) -> "Nuit du 10 au 11 novembre" */
export function nightLabel(iso) {
  if (!iso) return '';
  const a = parse(iso);
  const b = new Date(a.getTime() + 86400000);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  return `Nuit du ${a.getUTCDate()}${sameMonth ? '' : ' ' + MONTHS[a.getUTCMonth()]} au ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

export function shortDate(iso) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(parse(iso));
}

/** Heure française d'un match (ISO UTC). */
export function frTime(iso) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function timeAgo(iso) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export const periodLabel = (i) => (i < 4 ? `Q${i + 1}` : i === 4 ? 'Prol.' : `P${i - 3}`);

export const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
