import { useEffect, useState, useCallback } from 'react';
import { crmApi } from '../api/crmApi';

// Status → colour mapping
const statusColor = {
  Active:   { bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-500'    },
  Warm:     { bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-400'   },
  Hot:      { bg: 'bg-rose-50',    text: 'text-rose-700',    bar: 'bg-rose-500'    },
  Booked:   { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  Lost:     { bg: 'bg-slate-100',  text: 'text-slate-600',   bar: 'bg-slate-400'   },
  Inactive: { bg: 'bg-slate-50',   text: 'text-slate-500',   bar: 'bg-slate-300'   },
};
const fallback = { bg: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-400' };

function StageBar({ stage, count, total, defaultStatus }) {
  const c = statusColor[defaultStatus] || fallback;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-36 sm:w-44 flex-shrink-0 text-xs text-slate-700 truncate">{stage}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-0">
        <div className={`h-2 rounded-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`w-10 text-right text-xs font-bold ${c.text} flex-shrink-0`}>{count}</div>
      <div className="w-8 text-right text-[10px] text-slate-400 flex-shrink-0">{pct}%</div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className={`rounded-xl p-4 ${color} flex flex-col gap-1`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-75">{label}</div>
    </div>
  );
}

function TaskBucket({ label, count, color }) {
  return (
    <div className={`rounded-xl p-3 ${color} text-center`}>
      <div className="text-xl font-bold">{count}</div>
      <div className="text-[11px] font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

export default function CrmDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const d = await crmApi.getCrmDashboard();
      setData(d);
    } catch (err) {
      console.error('Failed to load CRM dashboard', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading dashboard…</div>
  );
  if (!data) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Could not load data.</div>
  );

  const { Summary, LeadStageDistribution, LeadStatusDistribution, TaskSummary, TaskByActivityType } = data;
  const totalLeads = Summary.totalLeads;

  // Group stages by their defaultStatus for section headers
  const activeStages    = LeadStageDistribution.filter(s => s.defaultStatus === 'Active');
  const warmStages      = LeadStageDistribution.filter(s => s.defaultStatus === 'Warm');
  const hotStages       = LeadStageDistribution.filter(s => s.defaultStatus === 'Hot');
  const bookedStages    = LeadStageDistribution.filter(s => s.defaultStatus === 'Booked');
  const lostStages      = LeadStageDistribution.filter(s => s.defaultStatus === 'Lost');
  const inactiveStages  = LeadStageDistribution.filter(s => s.defaultStatus === 'Inactive');

  const sections = [
    { label: '🔵 Active',   stages: activeStages,   color: statusColor.Active   },
    { label: '🟡 Warm',     stages: warmStages,     color: statusColor.Warm     },
    { label: '🔴 Hot',      stages: hotStages,      color: statusColor.Hot      },
    { label: '🟢 Booked',   stages: bookedStages,   color: statusColor.Booked   },
    { label: '⚫ Lost',     stages: lostStages,     color: statusColor.Lost     },
    { label: '⬜ Inactive', stages: inactiveStages, color: statusColor.Inactive },
  ].filter(s => s.stages.some(st => st.count > 0) || s.stages.length > 0);

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-6 max-w-5xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Lead & task distribution snapshot</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium">
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Leads"    value={Summary.totalLeads}     color="bg-slate-900 text-white" />
        <SummaryCard label="Fresh / Untouched" value={Summary.freshUntouched} color="bg-blue-600 text-white" />
        <SummaryCard label="Hot Leads"      value={Summary.hotLeads}       color="bg-rose-500 text-white" />
        <SummaryCard label="Booked"         value={Summary.bookedLeads}    color="bg-emerald-600 text-white" />
      </div>

      {/* ── LEAD STAGE ANALYSIS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Lead Stage Analysis</h2>
          <p className="text-xs text-slate-500 mt-0.5">{totalLeads} total leads across all stages</p>
        </div>
        <div className="p-5 space-y-5">
          {sections.map(({ label, stages, color }) => (
            <div key={label}>
              <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${color.text}`}>{label}</div>
              <div className="space-y-0.5">
                {stages.map(s => (
                  <StageBar key={s.stage} stage={s.stage} count={s.count} total={totalLeads} defaultStatus={s.defaultStatus} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TASK ANALYSIS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Task Analysis</h2>
          <p className="text-xs text-slate-500 mt-0.5">{TaskSummary.total} total tasks</p>
        </div>
        <div className="p-5 space-y-5">
          {/* Time buckets */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">By Schedule</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <TaskBucket label="Overdue"   count={TaskSummary.overdue}   color="bg-rose-50 text-rose-700" />
              <TaskBucket label="Due Today" count={TaskSummary.today}     color="bg-amber-50 text-amber-700" />
              <TaskBucket label="Upcoming"  count={TaskSummary.upcoming}  color="bg-blue-50 text-blue-700" />
              <TaskBucket label="Completed" count={TaskSummary.completed} color="bg-emerald-50 text-emerald-700" />
            </div>
          </div>

          {/* Activity type breakdown */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">By Activity Type</div>
            <div className="space-y-0.5">
              {(TaskByActivityType.length > 0 ? TaskByActivityType : []).map(({ type, count }) => {
                const pct = TaskSummary.total > 0 ? Math.round((count / TaskSummary.total) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-2 py-1.5">
                    <div className="w-28 flex-shrink-0 text-xs text-slate-700">{type}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-10 text-right text-xs font-bold text-indigo-700">{count}</div>
                    <div className="w-8 text-right text-[10px] text-slate-400">{pct}%</div>
                  </div>
                );
              })}
              {TaskByActivityType.length === 0 && (
                <p className="text-sm text-slate-400 py-2">No tasks yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
