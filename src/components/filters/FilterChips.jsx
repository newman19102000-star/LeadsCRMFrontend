import { X } from 'lucide-react';
import { describeRange } from './filterConfig';

// Active filters as removable chips, plus "Clear all".
export default function FilterChips({ filters, fields, options, dateFields, onChange, onClear, hideDate = false }) {
  const chips = [];
  for (const f of fields) {
    const values = filters[f.key] || [];
    if (!values.length) continue;
    const labels = values.map((v) => options?.[f.key]?.find((o) => o.value === v)?.label || v);
    chips.push({ id: f.key, text: `${f.label}: ${labels.join(', ')}`, remove: () => onChange({ ...filters, [f.key]: [] }) });
  }
  if (!hideDate && (filters.dateFrom || filters.dateTo)) {
    const field = dateFields.find((d) => d.value === filters.dateField)?.label || 'Date';
    chips.push({ id: 'date', text: `${field}: ${describeRange(filters.dateFrom, filters.dateTo)}`, remove: () => onChange({ ...filters, dateFrom: '', dateTo: '' }) });
  }
  if (filters.inactiveDays) {
    chips.push({ id: 'inactive', text: `No activity ${filters.inactiveDays}+ days`, remove: () => onChange({ ...filters, inactiveDays: null }) });
  }
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
      {chips.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800">
          <span className="truncate" title={c.text}>{c.text}</span>
          <button type="button" onClick={c.remove} className="p-0.5 rounded-full hover:bg-indigo-100 flex-shrink-0" aria-label={`Remove ${c.text}`}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="text-[11px] text-slate-500 underline px-1">Clear all</button>
    </div>
  );
}
