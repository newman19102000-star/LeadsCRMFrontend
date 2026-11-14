import { Eye } from 'lucide-react';

function fmtDate(val) {
  if (!val) return '';
  try { return new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return val; }
}

export default function MobileTaskCards({ tasks, loading, onViewTask }) {
  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Loading tasks…</div>;
  if (!tasks?.length) return <div className="py-12 text-center text-slate-400 text-sm">No tasks in this bucket.</div>;

  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tappable body */}
          <button className="w-full text-left px-4 pt-3 pb-2 block" onClick={() => onViewTask(t.id)}>
            {/* Activity type + schedule date */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{t.activityType}</span>
              <span className="text-[10px] text-slate-400">{fmtDate(t.scheduleDate)}</span>
            </div>
            {/* Lead name + phone */}
            <div className="font-bold text-slate-900 text-sm">{t.lead}</div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{t.mobile}</div>
            {/* Title + remark */}
            {t.title  && <div className="mt-1.5 text-[11px] font-semibold text-slate-700">{t.title}</div>}
            {t.remark && <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{t.remark}</div>}
            {/* Agents */}
            <div className="mt-1.5 text-[11px] text-slate-500 space-y-0.5">
              {t.assignedTo    && <div><span className="text-slate-400">Assigned to:</span> {t.assignedTo}</div>}
              {t.preSalesAgent && <div><span className="text-slate-400">Pre-Sales:</span> {t.preSalesAgent}</div>}
            </div>
          </button>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-1.5">
              {t.stage && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{t.stage}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
              }`}>{t.status}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onViewTask(t.id); }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-medium flex items-center gap-1"
            >
              <Eye className="w-3 h-3" /> View
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
