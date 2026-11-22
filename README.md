# NBA Recap

Une appli perso qui récapitule chaque nuit NBA. C'est une appli web installable (PWA) qui fonctionne sur Android et iPhone, et qu'on partage avec un simple lien.

- **Accueil** : les articles sur la nuit (récap, perf, match à revoir, top 5, séries, mes joueurs) et les news NBA traduites en français.
- **Résultats** : tous les matches de la nuit, avec un historique jour par jour.
  - Fiche de chaque match : **Résumé** (faits marquants, tournant du match, joueurs décisifs, chiffres clés), **Stats joueurs** (box score des deux équipes et duel d'équipes), **Classement & forme** (bilan, série, 5 derniers matches, classement de la conférence).
- **Classements** : conférences Est et Ouest.
- **Joueurs** : top 5 de la saison régulière en moyenne par match (points, passes, rebonds, contres et +/- sur le terrain), parmi les joueurs qualifiés selon ESPN.
  - **Mes joueurs** : une sélection de joueurs suivis, chacun avec sa fiche (moyennes de la saison, des 5 derniers matches, de la carrière, et saison par saison). La liste se modifie dans `scripts/players.json` (identifiant ESPN de chaque joueur).

## Comment ça marche

```
GitHub Actions (chaque matin)
  └─ scripts/update.mjs
       ├─ données ESPN (scores, box scores, play-by-play, classements, news)
       ├─ analyse : séries, écarts, quart-temps décisif, meilleures perfs
       ├─ rédaction automatique en français à partir des stats (scripts/lib/writer.mjs)
       ├─ traduction gratuite des news ESPN (MyMemory)
       └─ écrit public/data/*.json
  └─ build Vite et publication sur GitHub Pages
```

L'appli (dossier `src/`) se contente de lire ces fichiers JSON. Il n'y a ni serveur ni base de données.

## Mise en ligne (une seule fois)

1. Crée un compte sur [github.com](https://github.com), puis un **nouveau dépôt public** (par exemple `nba-recap`).
2. Envoie le code dessus :
   ```bash
   git remote add origin https://github.com/<ton-pseudo>/nba-recap.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
4. Lance une première mise à jour : **Actions → Mise à jour quotidienne → Run workflow**.
5. L'appli est en ligne sur `https://<ton-pseudo>.github.io/nba-recap/`.

Ensuite, tout est automatique : mise à jour à 8 h (heure de Paris, été comme hiver) chaque lendemain de journée de matches. Les jours sans match, rien ne change et l'appli garde la dernière nuit.

## Installer l'appli sur son téléphone

- **iPhone** : ouvrir le lien dans **Safari**, appuyer sur Partager, puis **Sur l'écran d'accueil**.
- **Android** : ouvrir le lien dans **Chrome**, ouvrir le menu ⋮, puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).

Pour la partager, il suffit d'envoyer le lien.

## Travailler en local

```bash
npm install
npm run update-data          # nuit dernière (ajoute --no-ai pour se passer de Claude)
node scripts/update.mjs --date=2026-11-10
npm run dev                  # http://localhost:5173
```

## Coût

L'appli fonctionne **gratuitement** : aucune clé n'est nécessaire. Les résumés et articles sont rédigés par des règles à partir des statistiques, et les news sont traduites par le service gratuit MyMemory. Si la traduction est indisponible ou son quota atteint, les news restent en anglais.

En option, ajouter un secret GitHub `ANTHROPIC_API_KEY` réactive la rédaction par Claude (payante). Les textes déjà rédigés par Claude sont conservés dans tous les cas.

## Ajouter une rubrique

1. Crée une page dans `src/pages/`.
2. Ajoute-la au tableau `NAV` et au routage dans `src/App.jsx`.
3. Si elle a besoin de nouvelles données, ajoute-les dans `scripts/update.mjs`.

## Limites à connaître

- Les données viennent de l'API publique **non officielle** d'ESPN. Elle est gratuite et sans clé, mais son format peut changer sans préavis.
- Les news sources sont en anglais (ESPN). Seuls le titre et le chapô sont traduits, automatiquement : la traduction peut être imparfaite.
