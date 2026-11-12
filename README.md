# NBA Recap

Une appli perso qui récapitule chaque nuit NBA. C'est une appli web installable (PWA) qui fonctionne sur Android et iPhone, et qu'on partage avec un simple lien.

- **Accueil** : les articles sur la nuit et les news NBA, rédigés en français par Claude.
- **Résultats** : tous les matches de la nuit, avec un historique jour par jour.
  - Fiche de chaque match : **Résumé** (faits marquants, tournant du match, joueurs décisifs, chiffres clés), **Stats joueurs** (box score des deux équipes et duel d'équipes), **Classement & forme** (bilan, série, 5 derniers matches, classement de la conférence).
- **Classements** : conférences Est et Ouest.
- **Joueurs** : top 5 de la saison régulière en moyenne par match (points, passes, rebonds, contres et +/- sur le terrain), parmi les joueurs qualifiés selon ESPN.

## Comment ça marche

```
GitHub Actions (chaque matin)
  └─ scripts/update.mjs
       ├─ données ESPN (scores, box scores, play-by-play, classements, news)
       ├─ analyse : séries, écarts, quart-temps décisif, meilleures perfs
       ├─ rédaction en français avec l'API Claude (sinon résumé automatique)
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
4. Récupère une clé API sur [console.anthropic.com](https://console.anthropic.com), puis ajoute-la dans **Settings → Secrets and variables → Actions → New repository secret**. Nom : `ANTHROPIC_API_KEY`.
5. Lance une première mise à jour : **Actions → Mise à jour quotidienne → Run workflow**.
6. L'appli est en ligne sur `https://<ton-pseudo>.github.io/nba-recap/`.

Ensuite, tout est automatique : mise à jour à 07:30 UTC (8 h 30 à Paris en hiver, 9 h 30 en été), puis un second passage à 10:30 UTC pour les matches terminés tard.

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

Sans la variable `ANTHROPIC_API_KEY`, le script génère des résumés automatiques à partir des stats.

## Coût de l'IA

Par défaut, le modèle est `claude-opus-5-5` avec un effort `low`. Compte de l'ordre de 0,03 à 0,05 $ par match, plus un appel pour les articles de l'accueil, soit quelques dizaines de centimes par nuit chargée. Le second passage du matin réutilise les textes déjà écrits.

Pour réduire le coût, définis la variable `CLAUDE_MODEL=claude-haiku-5-5` dans le workflow (environ 40 fois moins cher, mais avec une écriture moins fine).

## Ajouter une rubrique

1. Crée une page dans `src/pages/`.
2. Ajoute-la au tableau `NAV` et au routage dans `src/App.jsx`.
3. Si elle a besoin de nouvelles données, ajoute-les dans `scripts/update.mjs`.

## Limites à connaître

- Les données viennent de l'API publique **non officielle** d'ESPN. Elle est gratuite et sans clé, mais son format peut changer sans préavis.
- Les news sources sont en anglais (ESPN). Claude les reformule en français à partir du titre et du chapô uniquement.
