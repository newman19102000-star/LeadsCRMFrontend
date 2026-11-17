import { useCallback, useEffect, useState } from 'react';
import { sanitize } from '../components/filters/filterConfig';

function readSaved(storageKey, fields, empty) {
  if (!storageKey) return { ...empty };
  try {
    return sanitize(JSON.parse(localStorage.getItem(storageKey) || 'null'), fields, empty);
  } catch {
    return { ...empty };
  }
}

// Filters for one page, remembered on this device per user until cleared.
export function useSavedFilters(userId, page, fields, empty) {
  const storageKey = userId ? `crm_filters_v1_${userId}_${page}` : null;
  const [state, setState] = useState(() => ({ key: storageKey, filters: readSaved(storageKey, fields, empty) }));

  // A different user logged in on this device → switch to their saved filters (derived during render).
  let current = state;
  if (state.key !== storageKey) {
    current = { key: storageKey, filters: readSaved(storageKey, fields, empty) };
    setState(current);
  }

  useEffect(() => {
    if (!state.key) return;
    try {
      localStorage.setItem(state.key, JSON.stringify(state.filters));
    } catch { /* storage full or disabled: filters still work for this visit */ }
  }, [state]);

  const setFilters = useCallback((next) => {
    setState((s) => ({ ...s, filters: typeof next === 'function' ? next(s.filters) : next }));
  }, []);
  const clear = useCallback(() => setFilters({ ...empty }), [setFilters, empty]);

  return [current.filters, setFilters, clear];
}
