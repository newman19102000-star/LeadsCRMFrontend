import { useState } from 'react';
import { Download, SlidersHorizontal, X } from 'lucide-react';
import { crmApi } from '../api/crmApi';
import FilterPanel from './filters/FilterPanel';
import FilterChips from './filters/FilterChips';
import { EMPTY_LEAD_FILTERS, LEAD_DATE_FIELDS, countActive, toQueryParams } from './filters/filterConfig';

// The export period is the created-date range, so the Leads page's own date range and sort don't apply here.
const withoutDate = (f) => ({ ...f, dateField: 'created', dateFrom: '', dateTo: '', sort: 'newest' });

// Calendar dates are in the user's local time (IST for this team); the backend treats them as IST days, inclusive.
const pad = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function presetRange(preset) {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'week') from.setDate(from.getDate() - 6);          // last 7 days incl. today
  else if (preset === 'month') from.setMonth(from.getMonth() - 1); // same day last month → today
  else if (preset === 'quarter') from.setMonth(from.getMonth() - 3);
  else if (preset === 'year') from.setFullYear(from.getFullYear() - 1);
  if (preset !== 'week') from.setDate(from.getDate() + 1);
  return { from: toYmd(from), to: toYmd(to) };
}

const PRESETS = [
  { id: 'week', label: '1 Week' },
  { id: 'month', label: '1 Month' },
  { id: 'quarter', label: '1 Quarter' },
  { id: 'year', label: '1 Year' },
];

export default function LeadExportModal({ onClose, currentFilters, fields = [], options, loadingOptions, onNeedOptions }) {
  const [filters, setFilters] = useState(() => withoutDate(currentFilters || EMPTY_LEAD_FILTERS));
  const [panelOpen, setPanelOpen] = useState(false);
  const activeCount = countActive(filters, fields);
  const pageCount = countActive(withoutDate(currentFilters || EMPTY_LEAD_FILTERS), fields);
  const sameAsPage = JSON.stringify(toQueryParams(filters, fields)) === JSON.stringify(toQueryParams(withoutDate(currentFilters || EMPTY_LEAD_FILTERS), fields));
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const today = toYmd(new Date());
  const invalid = !range.from || !range.to || range.from > range.to;

  const choosePreset = (id) => {
    setPreset(id);
    setRange(presetRange(id));
    setError('');
  };

  const setCustom = (field, value) => {
    setPreset('custom');
    setRange((r) => ({ ...r, [field]: value }));
    setError('');
  };

  const download = async () => {
    if (invalid || downloading) return;
    setDownloading(true);
    setError('');
    try {
      const { blob, fileName } = await crmApi.exportLeads(range.from, range.to, toQueryParams(filters, fields));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onClose();
    } catch (err) {
      let message = err.message;
      // Errors come back as a Blob because the request asks for binary data
      const data = err.response?.data;
      if (data instanceof Blob) {
        try { message = JSON.parse(await data.text()).message || message; } catch { /* keep default */ }
      }
      setError(err.response?.status === 403 ? 'Only admins can export leads.' : `Export failed: ${message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="lead-export-modal">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl text-left max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900">Export Leads to Excel</h2>
            <p className="text-xs text-slate-500 mt-0.5">Leads created in the selected period, with status, calls, tasks and activity.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePreset(p.id)}
                className={`py-2 rounded-lg border text-xs font-semibold transition ${
                  preset === p.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
              Date range {preset === 'custom' && <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px]">Custom</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[10px] text-slate-500 mb-0.5">From</span>
                <input
                  type="date" value={range.from} max={range.to || today}
                  onChange={(e) => setCustom('from', e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] text-slate-500 mb-0.5">To</span>
                <input
                  type="date" value={range.to} min={range.from} max={today}
                  onChange={(e) => setCustom('to', e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm"
                />
              </label>
            </div>
            {invalid && <p className="text-[11px] text-rose-600 mt-1">Pick a start date on or before the end date.</p>}
          </div>

          <div className="space-y-2" data-testid="export-filters">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">
                Filters {activeCount === 0 && <span className="font-normal text-slate-400">(none, all leads in the period)</span>}
              </span>
              <button
                type="button"
                onClick={() => { setPanelOpen(true); onNeedOptions?.(); }}
                data-testid="export-filters-button"
                className="text-xs px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> {activeCount ? 'Edit filters' : 'Add filters'}
              </button>
            </div>
            <FilterChips
              filters={filters}
              fields={fields}
              options={options}
              dateFields={LEAD_DATE_FIELDS}
              hideDate
              onChange={setFilters}
              onClear={() => setFilters({ ...EMPTY_LEAD_FILTERS })}
            />
            {pageCount > 0 && !sameAsPage && (
              <button type="button" onClick={() => setFilters(withoutDate(currentFilters))} className="text-[11px] text-indigo-600 underline">
                Use the Leads page filters
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            The file has four sheets: Summary (including the filters used), Leads (one row per lead), Activity Log (calls, stage changes, transfers) and Tasks.
          </p>
          {error && <p className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button" onClick={download} disabled={invalid || downloading}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" /> {downloading ? 'Preparing…' : 'Download'}
          </button>
        </div>
      </div>

      <FilterPanel
        open={panelOpen}
        title="Export filters"
        fields={fields}
        options={options}
        loadingOptions={loadingOptions}
        value={filters}
        empty={EMPTY_LEAD_FILTERS}
        dateFields={LEAD_DATE_FIELDS}
        showDate={false}
        showInactive
        onApply={(f) => setFilters(withoutDate(f))}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
