import { useEffect, useState } from 'react';
import { useRoute, href } from './router.js';
import Home from './pages/Home.jsx';
import Results from './pages/Results.jsx';
import Game from './pages/Game.jsx';
import Standings from './pages/Standings.jsx';
import Article from './pages/Article.jsx';
import Leaders from './pages/Leaders.jsx';

// Onglets latéraux : "Résultats" en premier. Ajouter ici les prochaines rubriques.
const NAV = [
  { key: 'resultats', label: 'Résultats', icon: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h10v2H4z' },
  { key: 'classements', label: 'Classements', icon: 'M5 20V10h3v10zm5.5 0V4h3v16zM16 20v-7h3v7z' },
  { key: 'joueurs', label: 'Joueurs', icon: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10c0-3.9 3.1-7 7-7s7 3.1 7 7' },
  { key: '', label: 'Actus', icon: 'M5 4h11l3 3v13H5zm3 5h8M8 12h8M8 15h5' },
];

export default function App() {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route.join('/')]);

  const section = route[0] || '';
  const active = section === 'match' ? 'resultats' : section === 'article' ? '' : section;

  let page;
  if (section === 'resultats') page = <Results date={route[1]} />;
  else if (section === 'match') page = <Game date={route[1]} id={route[2]} tab={route[3]} />;
  else if (section === 'classements') page = <Standings />;
  else if (section === 'joueurs') page = <Leaders />;
  else if (section === 'article') page = <Article date={route[1]} id={route[2]} />;
  else page = <Home />;

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <header className="topbar">
        <button className="icon-btn burger" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <a className="brand" href={href()}>
          <span className="brand-ball" aria-hidden="true" />
          NBA <b>Recap</b>
        </a>
      </header>

      <nav className="sidenav" aria-label="Rubriques">
        <a className="brand side-brand" href={href()}>
          <span className="brand-ball" aria-hidden="true" />
          NBA <b>Recap</b>
        </a>
        {NAV.map((n) => (
          <a key={n.label} href={href(n.key)} className={`nav-item ${active === n.key ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            {n.label}
          </a>
        ))}
        <div className="nav-soon">D'autres rubriques arrivent bientôt.</div>
      </nav>
      <div className="scrim" onClick={() => setOpen(false)} />

      <main className="content">{page}</main>
    </div>
  );
}
