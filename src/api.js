// Accès aux fichiers JSON générés chaque matin par scripts/update.mjs.
import { useEffect, useState } from 'react';

const cache = new Map();

export function load(path) {
  if (!cache.has(path)) {
    const p = fetch(`./data/${path}`, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`Données introuvables (${path})`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

export const loadIndex = () => load('index.json');
export const loadDay = (date) => (date ? load(`days/${date}.json`) : load('latest.json'));
export const loadStandings = () => load('standings.json');

/** Hook simple : { data, error, loading } pour une promesse dépendant de `deps`. */
export function useData(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
