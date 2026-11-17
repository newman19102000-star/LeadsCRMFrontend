// Filter definitions for the Leads and Tasks pages. `key` is the query-string name the backend expects.
// `people: true` → only shown to admins / "view all" users (others only see their own records anyway).

export const LEAD_FIELDS = [
  { key: 'stage', label: 'Stage', group: 'main' },
  { key: 'status', label: 'Status', group: 'main' },
  { key: 'preSalesId', label: 'Pre-Sales Agent', group: 'main', people: true },
  { key: 'salesId', label: 'Sales Agent', group: 'main', people: true },
  { key: 'projectId', label: 'Project', group: 'main' },
  { key: 'campaign', label: 'Campaign', group: 'main' },
  { key: 'source', label: 'Source', group: 'main' },
  { key: 'stageReason', label: 'Stage Reason', group: 'more' },
  { key: 'tag', label: 'Tags', group: 'more' },
  { key: 'siteVisit', label: 'Site Visit', group: 'more' },
  { key: 'requirement', label: 'Requirement', group: 'more' },
  { key: 'subLocation', label: 'Location', group: 'more' },
  { key: 'budget', label: 'Budget', group: 'more' },
  { key: 'ethnicity', label: 'Ethnicity', group: 'more' },
  { key: 'sourcingManagerId', label: 'Sourcing Manager', group: 'more', people: true },
  { key: 'channelPartnerId', label: 'Channel Partner', group: 'more' },
  { key: 'adName', label: 'Ad', group: 'more' },
  { key: 'formName', label: 'Form', group: 'more' },
  { key: 'pageName', label: 'Facebook Page', group: 'more' },
];

export const LEAD_DATE_FIELDS = [
  { value: 'created', label: 'Created date' },
  { value: 'assigned', label: 'Assigned date' },
  { value: 'lastActivity', label: 'Last activity' },
];

export const INACTIVE_CHOICES = [3, 7, 14, 30];

export const LEAD_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'recentActivity', label: 'Recently active' },
  { value: 'staleFirst', label: 'Longest without activity' },
];

export const TASK_FIELDS = [
  { key: 'activityType', label: 'Activity Type', group: 'main' },
  { key: 'status', label: 'Task Status', group: 'main' },
  { key: 'stage', label: 'Stage', group: 'main' },
  { key: 'assignedToId', label: 'Assigned To', group: 'main', people: true },
  { key: 'projectId', label: 'Project', group: 'main' },
  { key: 'assignedById', label: 'Assigned By', group: 'more', people: true },
  { key: 'preSalesId', label: 'Pre-Sales Agent', group: 'more', people: true },
  { key: 'category', label: 'Category', group: 'more' },
];

export const TASK_DATE_FIELDS = [
  { value: 'scheduled', label: 'Scheduled date' },
  { value: 'created', label: 'Created date' },
  { value: 'completed', label: 'Completed date' },
];

export const EMPTY_LEAD_FILTERS = { dateField: 'created', dateFrom: '', dateTo: '', inactiveDays: null, sort: 'newest' };
export const EMPTY_TASK_FILTERS = { search: '', dateField: 'scheduled', dateFrom: '', dateTo: '' };

// Number of active filters (lists with values, a date range, inactivity). Sort and search don't count.
export function countActive(filters, fields) {
  let n = fields.filter((f) => (filters[f.key] || []).length > 0).length;
  if (filters.dateFrom || filters.dateTo) n += 1;
  if (filters.inactiveDays) n += 1;
  return n;
}

// Only the parts the backend needs; empty values are dropped so URLs stay short.
export function toQueryParams(filters, fields) {
  const params = {};
  for (const f of fields) {
    const v = filters[f.key];
    if (Array.isArray(v) && v.length) params[f.key] = v;
  }
  if (filters.dateFrom || filters.dateTo) {
    params.dateField = filters.dateField;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
  }
  if (filters.inactiveDays) params.inactiveDays = filters.inactiveDays;
  if (filters.sort && filters.sort !== 'newest') params.sort = filters.sort;
  if (filters.search && filters.search.trim()) params.search = filters.search.trim();
  return params;
}

// Removes values that can't be valid any more (e.g. saved by an older version of the app).
export function sanitize(saved, fields, empty) {
  const out = { ...empty };
  if (!saved || typeof saved !== 'object') return out;
  for (const f of fields) {
    if (Array.isArray(saved[f.key])) out[f.key] = saved[f.key].filter((x) => typeof x === 'string' || typeof x === 'number').slice(0, 50).map(String);
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const dateFields = [...LEAD_DATE_FIELDS, ...TASK_DATE_FIELDS].map((d) => d.value);
  for (const k of Object.keys(empty)) {
    const v = saved[k];
    if (k === 'inactiveDays') { if (v === null || INACTIVE_CHOICES.includes(v)) out[k] = v; continue; }
    if (k === 'dateFrom' || k === 'dateTo') { if (v === '' || (typeof v === 'string' && dateRe.test(v))) out[k] = v; continue; }
    if (k === 'dateField') { if (dateFields.includes(v)) out[k] = v; continue; }
    if (k === 'sort') { if (LEAD_SORTS.some((s) => s.value === v)) out[k] = v; continue; }
    if (typeof v === typeof empty[k]) out[k] = v;
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function datePreset(preset) {
  const today = new Date();
  const from = new Date(today);
  if (preset === 'today') return { dateFrom: ymd(today), dateTo: ymd(today) };
  if (preset === 'yesterday') { from.setDate(from.getDate() - 1); return { dateFrom: ymd(from), dateTo: ymd(from) }; }
  if (preset === 'last7') { from.setDate(from.getDate() - 6); return { dateFrom: ymd(from), dateTo: ymd(today) }; }
  if (preset === 'last30') { from.setDate(from.getDate() - 29); return { dateFrom: ymd(from), dateTo: ymd(today) }; }
  if (preset === 'thisMonth') { from.setDate(1); return { dateFrom: ymd(from), dateTo: ymd(today) }; }
  if (preset === 'next7') { const to = new Date(today); to.setDate(to.getDate() + 6); return { dateFrom: ymd(today), dateTo: ymd(to) }; }
  return { dateFrom: '', dateTo: '' };
}

const fmt = (s) => {
  if (!s) return '…';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const describeRange = (from, to) => (from && from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`);
