import { MoreVertical, Calendar, Eye, CheckSquare, ArrowRightLeft, UserPlus, Users, Building2, Edit3, Trash2 } from 'lucide-react';

const statusColors = {
  Hot: 'bg-rose-100 text-rose-700',
  Warm: 'bg-amber-100 text-amber-700',
  Booked: 'bg-emerald-100 text-emerald-700',
};

function fmtDate(val) {
  if (!val) return '';
  try { return new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return val; }
}

export default function MobileLeadCards({
  leads, loading, openMenuLeadId, setOpenMenuLeadId,
  onViewDetails, handleRowAction, isAdmin
}) {
  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Loading leads…</div>;
  if (!leads?.length) return <div className="py-12 text-center text-slate-400 text-sm">No leads found.</div>;

  return (
    <div className="space-y-3">
      {leads.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
          {/* Tappable body → View Details */}
          <button
            className="w-full text-left px-4 pt-3 pb-2 block"
            onClick={() => onViewDetails(r)}
          >
            {/* Lead ID + date */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-indigo-500 font-semibold tracking-wide">{r.leadId}</span>
              <span className="text-[10px] text-slate-400">{fmtDate(r.date)}</span>
            </div>
            {/* Name */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">{r.name}</span>
              {r.inquiryCount > 1 && (
                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Re-Inquiry ×{r.inquiryCount}</span>
              )}
              {r.isConvertedToContact && (
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Contact</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.primaryNo}</div>
            {/* Info snippets */}
            <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 leading-relaxed">
              {r.project   && <div><span className="text-slate-400">Project:</span> {r.project}</div>}
              {r.source    && <div><span className="text-slate-400">Source:</span> {r.source}</div>}
              {r.requirement && <div className="line-clamp-1"><span className="text-slate-400">Req:</span> {r.requirement}</div>}
              {r.budget    && <div><span className="text-slate-400">Budget:</span> {r.budget}</div>}
              {r.preSalesAgent && <div><span className="text-slate-400">Agent:</span> {r.preSalesAgent}</div>}
            </div>
          </button>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[r.status] || 'bg-blue-100 text-blue-700'}`}>
                {r.status}
              </span>
              {r.leadStage && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                  {r.leadStage}
                </span>
              )}
              {Array.isArray(r.tags) && r.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 text-slate-600">{tag}</span>
              ))}
            </div>

            {/* Kebab menu */}
            <div className="relative flex-shrink-0 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuLeadId(openMenuLeadId === r.id ? null : r.id);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {openMenuLeadId === r.id && (
                <div className="absolute right-0 bottom-9 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 text-left">
                  <button onClick={() => handleRowAction('add_task', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" /> Add Task / Update Stage
                  </button>
                  <button onClick={() => handleRowAction('view', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Eye className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" /> View Details
                  </button>
                  <button onClick={() => handleRowAction('convert', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> Convert to Contact
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleRowAction('transfer', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" /> Transfer Lead
                    </button>
                  )}
                  <button onClick={() => handleRowAction('add_owner', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <UserPlus className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" /> Add Owner
                  </button>
                  <button onClick={() => handleRowAction('remove_owner', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Users className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" /> Remove Lead Owner
                  </button>
                  <button onClick={() => handleRowAction('add_cp', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" /> Add Channel Partner
                  </button>
                  <button onClick={() => handleRowAction('remove_cp', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" /> Remove Channel Partner
                  </button>
                  <button onClick={() => handleRowAction('suggest_property', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> Suggested Property
                  </button>
                  <button onClick={() => handleRowAction('edit', r)} className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700">
                    <Edit3 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" /> Edit
                  </button>
                  {isAdmin && (
                    <>
                      <hr className="my-1 border-slate-100" />
                      <button onClick={() => handleRowAction('delete', r)} className="w-full px-3 py-2.5 hover:bg-rose-50 flex items-center gap-2.5 text-xs text-rose-600">
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
