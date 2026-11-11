// Mini-routeur basé sur le hash (#/...) : compatible GitHub Pages sans configuration.
import { useEffect, useState } from 'react';

const current = () => (window.location.hash.replace(/^#/, '') || '/').split('?')[0];

export function useRoute() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const on = () => { setPath(current()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path.split('/').filter(Boolean);
}

export const href = (...parts) => `#/${parts.filter((p) => p !== undefined && p !== null && p !== '').join('/')}`;
export const go = (...parts) => { window.location.hash = href(...parts); };
