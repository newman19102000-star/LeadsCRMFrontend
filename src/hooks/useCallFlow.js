import { useState, useEffect, useCallback, useRef } from 'react';
import { crmApi } from '../api/crmApi';

const STORAGE_KEY = 'crm_pending_call';
export const MIN_AWAY_MS = 3000;                 // ignore returns faster than this
export const EXPIRY_MS = 2 * 60 * 60 * 1000;     // forget pending calls older than 2h
export const MAX_ESTIMATE_SECONDS = 4 * 60 * 60; // cap the duration estimate at 4h

// Decides what to do with a pending call when the worker comes back to the app.
//   'drop'   -> too old, forget it (the "Initiated" entry stays on the timeline)
//   'wait'   -> came back too quickly, probably not a real call yet
//   'prompt' -> show the "how did it go?" sheet, with a duration estimate
export function evaluatePendingCall(pending, now = Date.now()) {
  const age = now - pending.startedAt;
  if (age > EXPIRY_MS) return { action: 'drop' };
  if (age < MIN_AWAY_MS) return { action: 'wait' };
  return { action: 'prompt', durationSeconds: Math.min(Math.round(age / 1000), MAX_ESTIMATE_SECONDS) };
}

function readPending() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Click-to-call via the phone's dialer (tel: link).
 * - Records that a call was made the moment the worker taps Call.
 * - When the worker returns to the app, opens a sheet to fill in outcome/duration.
 * - Skipping the sheet leaves the call recorded as "Initiated".
 */
export function useCallFlow({ enabled = true, onChange } = {}) {
  const [sheet, setSheet] = useState(null);
  const hiddenRef = useRef(false);
  const startPromiseRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const maybePrompt = useCallback(() => {
    const pending = readPending();
    if (!pending) return;
    const result = evaluatePendingCall(pending);
    if (result.action === 'drop') { localStorage.removeItem(STORAGE_KEY); return; }
    if (result.action === 'wait') return;
    localStorage.removeItem(STORAGE_KEY); // the sheet owns it from here
    setSheet({
      ...pending,
      durationSeconds: result.durationSeconds,
      estimated: true,
      startPromise: pending.activityId ? null : startPromiseRef.current,
    });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    maybePrompt(); // covers a reload / killed tab while the call was in progress

    const onVisibility = () => {
      if (document.hidden) { hiddenRef.current = true; return; }
      if (hiddenRef.current) { hiddenRef.current = false; maybePrompt(); }
    };
    const onPageShow = () => { hiddenRef.current = false; maybePrompt(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled, maybePrompt]);

  const startCall = useCallback((lead) => {
    const phone = String(lead.primaryNo || '').trim();
    if (!phone || phone === '-') { alert('This lead has no phone number.'); return; }

    const pending = {
      leadId: lead.id, leadName: lead.name, leadStage: lead.leadStage || 'New Lead',
      phone, startedAt: Date.now(), activityId: null,
    };
    const touch = isTouchDevice();
    if (touch) localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

    // 1. Record the call. Never block the dialer on this request.
    const startPromise = crmApi.startCall(lead.id)
      .then((res) => {
        const stored = readPending();
        if (stored && stored.startedAt === pending.startedAt) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, activityId: res.activityId }));
        }
        setSheet((s) => (s && s.startedAt === pending.startedAt ? { ...s, activityId: res.activityId } : s));
        onChangeRef.current?.();
        return res;
      })
      .catch((err) => { console.error('Could not record call start', err); return null; });
    startPromiseRef.current = startPromise;

    // 2. Open the dialer, still inside the tap handler.
    window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;

    // 3. No app-switch on desktop, so there is no "return" moment: ask right away, without a duration.
    if (!touch) {
      setSheet({ ...pending, durationSeconds: null, estimated: false, startPromise });
    }
  }, []);

  // Log a call that was made outside the CRM (no dialing, nothing recorded yet).
  const logManual = useCallback((lead) => {
    setSheet({
      leadId: lead.id, leadName: lead.name, leadStage: lead.leadStage || 'New Lead',
      phone: lead.primaryNo || '', startedAt: Date.now(), activityId: null, durationSeconds: null, estimated: false, manual: true,
    });
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  return { sheet, startCall, logManual, closeSheet };
}
