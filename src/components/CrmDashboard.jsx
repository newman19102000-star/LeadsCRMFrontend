import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { crmApi } from '../api/crmApi';

// Order and styling of the six status groups
const GROUPS = [
  { key: 'Active',   label: 'Active',   bar: 'bg-blue-500',    dot: 'bg-blue-500',    text: 'text-blue-700'    },
  { key: 'Warm',     label: 'Warm',     bar: 'bg-amber-400',   dot: 'bg-amber-400',   text: 'text-amber-700'   },
  { key: 'Hot',      label: 'Hot',      bar: 'bg-rose-500',    dot: 'bg-rose-500',    text: 'text-rose-700'    },
  { key: 'Booked',   label: 'Booked',   bar: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { key: 'Lost',     label: 'Lost',     bar: 'bg-slate-400',   dot: 'bg-slate-400',   text: 'text-slate-600'   },
  { key: 'Inactive', label: 'Inactive', bar: 'bg-slate-300',   dot: 'bg-slate-300',   text: 'text-slate-500'   },
];

function TaskTile({ label, count, tone, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-left transition hover:shadow-md active:scale-[0.98] ${tone}`}
    >
      <div className="text-2xl font-bold leading-none">{count}</div>
      <div className="text-[11px] font-medium mt-1 opacity-80">{label}</div>
    </button>
  );
}

function StageRow({ stage, count, groupTotal, group, onClick }) {
  const pct = groupTotal > 0 ? Math.round((count / groupTotal) * 100) : 0;
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className="w-full flex items-center gap-2 py-1.5 px-1 rounded hover:bg-slate-50 disabled:hover:bg-transparent disabled:cursor-default text-left"
    >
      <span className={`w-40 sm:w-52 flex-shrink-0 text-xs truncate ${count === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{stage}</span>
      <span className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-0">
        <span className={`block h-1.5 rounded-full ${group.bar}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`w-8 text-right text-xs font-bold flex-shrink-0 ${count === 0 ? 'text-slate-300' : group.text}`}>{count}</span>
    </button>
  );
}

export default function CrmDashboard({ onOpenStage, onOpenTasks }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [showEmpty, setShowEmpty] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await crmApi.getCrmDashboard());
    } catch (err) {
      console.error('Failed to load CRM dashboard', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (setter, key) =>
    setter(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading dashboard…</div>;
  }
  if (!data) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Could not load data.</div>;
  }

  // The API returns camelCase keys
  const summary = data.summary || {};
  const stages = data.leadStageDistribution || [];
  const tasks = data.taskSummary || { total: 0, overdue: 0, today: 0, upcoming: 0, completed: 0 };
  const byType = data.taskByActivityType || [];
  const totalLeads = summary.totalLeads || 0;

  const groups = GROUPS.map(g => {
    const items = stages.filter(s => s.defaultStatus === g.key);
    return { ...g, items, total: items.reduce((n, s) => n + s.count, 0) };
  });
  const allOpen = openGroups.size === groups.length;

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tap a tile or stage to open the matching list</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tasks: what needs action */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tasks</h2>
          <span className="text-[11px] text-slate-400">{tasks.total} total</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <TaskTile label="Overdue"   count={tasks.overdue}   tone="bg-rose-50 text-rose-700"       onClick={() => onOpenTasks?.('pending')} />
          <TaskTile label="Due today" count={tasks.today}     tone="bg-amber-50 text-amber-700"     onClick={() => onOpenTasks?.('today')} />
          <TaskTile label="Upcoming"  count={tasks.upcoming}  tone="bg-blue-50 text-blue-700"       onClick={() => onOpenTasks?.('upcoming')} />
          <TaskTile label="Completed" count={tasks.completed} tone="bg-emerald-50 text-emerald-700" onClick={() => onOpenTasks?.('completed')} />
        </div>
        {byType.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {byType.map(({ type, count }) => (
              <span key={type} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                {type} <span className="font-bold text-slate-800">{count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Leads: status overview + stage detail */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Leads</h2>
            <span className="text-[11px] text-slate-400">
              {totalLeads} total · {summary.freshUntouched || 0} untouched
            </span>
          </div>

          {/* Stacked status bar */}
          {totalLeads > 0 ? (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                {groups.filter(g => g.total > 0).map(g => (
                  <div
                    key={g.key}
                    className={g.bar}
                    style={{ width: `${(g.total / totalLeads) * 100}%` }}
                    title={`${g.label}: ${g.total}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {groups.map(g => (
                  <span key={g.key} className="flex items-center gap-1 text-[11px] text-slate-600">
                    <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                    {g.label} <span className="font-bold text-slate-800">{g.total}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 py-2">No leads yet.</p>
          )}
        </div>

        {/* Accordions */}
        <div className="border-t border-slate-100">
          <div className="flex justify-end px-4 pt-2">
            <button
              onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map(g => g.key)))}
              className="text-[11px] text-indigo-600 hover:underline"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          {groups.map(g => {
            const open = openGroups.has(g.key);
            const filled = g.items.filter(s => s.count > 0);
            const empty = g.items.filter(s => s.count === 0);
            const empties = showEmpty.has(g.key);
            return (
              <div key={g.key} className="border-b border-slate-100 last:border-b-0">
                <button
                  onClick={() => toggle(setOpenGroups, g.key)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-left"
                  aria-expanded={open}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} />
                  <span className="text-sm font-semibold text-slate-800 flex-1">{g.label}</span>
                  <span className={`text-sm font-bold ${g.text}`}>{g.total}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="px-4 pb-3">
                    {filled.length === 0 && (
                      <p className="text-xs text-slate-400 py-1">No leads in this group.</p>
                    )}
                    {filled.map(s => (
                      <StageRow
                        key={s.stage}
                        stage={s.stage}
                        count={s.count}
                        groupTotal={g.total}
                        group={g}
                        onClick={() => onOpenStage?.(s.stage)}
                      />
                    ))}
                    {empty.length > 0 && (
                      <>
                        <button
                          onClick={() => toggle(setShowEmpty, g.key)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 mt-1"
                        >
                          {empties ? 'Hide' : 'Show'} {empty.length} empty stage{empty.length > 1 ? 's' : ''}
                        </button>
                        {empties && empty.map(s => (
                          <StageRow key={s.stage} stage={s.stage} count={0} groupTotal={g.total} group={g} />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
