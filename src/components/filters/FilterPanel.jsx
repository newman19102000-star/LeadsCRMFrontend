import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { INACTIVE_CHOICES, countActive, datePreset } from './filterConfig';

/**
 * Filter drawer (desktop: right side panel, phone: bottom sheet).
 * Changes are made on a draft and only applied with "Apply", so the list doesn't reload on every tick.
 */
export default function FilterPanel({
  open, title = 'Filters', fields, options, loadingOptions, value, empty, onApply, onClose,
  dateFields, datePresets = ['today', 'yesterday', 'last7', 'last30', 'thisMonth'], showInactive = false, showDate = true,
  mineLabel = null, // e.g. "Only leads assigned to me" — shown only to users who can see everyone's records
}) {
  // Mounted only while open, so the draft starts from the applied filters every time it opens.
  if (!open) return null;
  return <PanelBody {...{ title, fields, options, loadingOptions, value, empty, onApply, onClose, dateFields, datePresets, showInactive, showDate, mineLabel }} />;
}

function PanelBody({
  title, fields, options, loadingOptions, value, empty, onApply, onClose, dateFields, datePresets, showInactive, showDate, mineLabel,
}) {
  const [draft, setDraft] = useState(value);
  const [openSection, setOpenSection] = useState(null);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const main = fields.filter((f) => f.group === 'main');
  const more = fields.filter((f) => f.group !== 'main');
  const draftCount = countActive(draft, fields);
  const rangeInvalid = draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo;

  const section = (f) => (
    <MultiSelectSection
      key={f.key}
      field={f}
      options={options?.[f.key] || []}
      loading={loadingOptions}
      selected={draft[f.key] || []}
      onChange={(v) => set(f.key, v)}
      open={openSection === f.key}
      onToggle={() => setOpenSection((s) => (s === f.key ? null : f.key))}
    />
  );

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex sm:justify-end items-end sm:items-stretch bg-black/40" data-testid="filter-panel"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:w-[400px] max-h-[88dvh] sm:max-h-none sm:h-full rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col text-left">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="font-bold text-slate-900">{title}{draftCount > 0 && <span className="ml-2 text-xs font-semibold text-indigo-600">{draftCount} active</span>}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Close filters"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4 text-sm">
          {mineLabel && (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer" data-testid="filter-mine">
              <span className="text-xs font-semibold text-slate-700">{mineLabel}</span>
              <input type="checkbox" checked={!!draft.mine} onChange={(e) => set('mine', e.target.checked)} className="w-4 h-4" />
            </label>
          )}
          {showDate && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">Date range</span>
                <select value={draft.dateField} onChange={(e) => set('dateField', e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs bg-white" aria-label="Date field">
                  {dateFields.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {datePresets.map((p) => {
                  const r = datePreset(p);
                  const active = draft.dateFrom === r.dateFrom && draft.dateTo === r.dateTo;
                  const label = { today: 'Today', yesterday: 'Yesterday', last7: 'Last 7 days', last30: 'Last 30 days', thisMonth: 'This month', next7: 'Next 7 days' }[p];
                  return (
                    <button key={p} type="button" onClick={() => setDraft((d) => ({ ...d, ...r }))}
                      className={`px-2.5 py-1 rounded-full border text-xs ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                      {label}
                    </button>
                  );
                })}
                {(draft.dateFrom || draft.dateTo) && (
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, dateFrom: '', dateTo: '' }))}
                    className="px-2.5 py-1 rounded-full text-xs text-slate-500 underline">Any date</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="block text-[10px] text-slate-500 mb-0.5">From</span>
                  <input type="date" value={draft.dateFrom} onChange={(e) => set('dateFrom', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></label>
                <label className="block"><span className="block text-[10px] text-slate-500 mb-0.5">To</span>
                  <input type="date" value={draft.dateTo} min={draft.dateFrom || undefined} onChange={(e) => set('dateTo', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" /></label>
              </div>
              {rangeInvalid && <p className="text-[11px] text-rose-600">The end date must be on or after the start date.</p>}
            </div>
          )}

          {showInactive && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700">No activity for</span>
              <div className="flex flex-wrap gap-1.5">
                {[null, ...INACTIVE_CHOICES].map((d) => (
                  <button key={String(d)} type="button" onClick={() => set('inactiveDays', d)}
                    className={`px-2.5 py-1 rounded-full border text-xs ${draft.inactiveDays === d ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    {d === null ? 'Any' : `${d}+ days`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">{main.map(section)}</div>
          {more.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">More columns</div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">{more.map(section)}</div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-200 flex-shrink-0">
          <button type="button" onClick={() => setDraft({ ...empty, sort: draft.sort ?? empty.sort, search: draft.search ?? empty.search })}
            className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50">
            Reset
          </button>
          <button type="button" disabled={rangeInvalid} onClick={() => { onApply(draft); onClose(); }}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MultiSelectSection({ field, options, loading, selected, onChange, open, onToggle }) {
  const [q, setQ] = useState('');
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);
  // Keep selected values listed even if they no longer appear in the data
  const missing = selected.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v, count: 0 }));
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const summary = selected.length === 0 ? 'Any'
    : selected.map((v) => options.find((o) => o.value === v)?.label || v).slice(0, 2).join(', ') + (selected.length > 2 ? ` +${selected.length - 2}` : '');

  return (
    <div data-testid={`filter-section-${field.key}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="text-xs font-semibold text-slate-700">{field.label}</span>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs truncate ${selected.length ? 'text-indigo-700 font-medium' : 'text-slate-400'}`}>{summary}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {options.length > 8 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${field.label.toLowerCase()}…`}
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded" />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {loading && options.length === 0 && <div className="text-xs text-slate-400 py-1">Loading…</div>}
            {!loading && options.length === 0 && missing.length === 0 && <div className="text-xs text-slate-400 py-1">No values yet.</div>}
            {[...missing, ...visible].map((o) => (
              <label key={o.value} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="flex-1 text-xs text-slate-700 break-words">{o.label}</span>
                {o.count > 0 && <span className="text-[10px] text-slate-400">{o.count}</span>}
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-[11px] text-slate-500 underline">Clear {field.label.toLowerCase()}</button>
          )}
        </div>
      )}
    </div>
  );
}
