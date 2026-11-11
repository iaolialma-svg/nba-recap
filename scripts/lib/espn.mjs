// Récupération des données NBA depuis l'API publique (non officielle) d'ESPN.
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'nba-recap/0.1' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

/** Matches d'une date US (format YYYYMMDD). */
export const fetchScoreboard = (yyyymmdd) => getJson(`${SITE}/scoreboard?dates=${yyyymmdd}`);

/** Détail complet d'un match : box score, play-by-play, classement de division… */
export const fetchSummary = (eventId) => getJson(`${SITE}/summary?event=${eventId}`);

/** Calendrier/résultats d'une équipe (pour la forme du moment). */
export const fetchTeamSchedule = (teamId) => getJson(`${SITE}/teams/${teamId}/schedule`);

/** Classement complet par conférence. */
export const fetchStandings = () => getJson(STANDINGS);

/** Dernières news NBA (en anglais). */
export const fetchNews = (limit = 25) => getJson(`${SITE}/news?limit=${limit}`);
