import { createPortal } from 'react-dom';
import { MoreVertical, Calendar, Eye, CheckSquare, ArrowRightLeft, UserPlus, Users, Building2, Edit3, Trash2, X } from 'lucide-react';

const statusColors = {
  Hot:    'bg-rose-100 text-rose-700',
  Warm:   'bg-amber-100 text-amber-700',
  Booked: 'bg-emerald-100 text-emerald-700',
};

function fmt(val) {
  if (!val) return '';
  try { return new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return val; }
}

function ActionSheet({ lead, onClose, handleRowAction, isAdmin }) {
  const items = [
    { action: 'add_task',         label: 'Add Task / Update Stage', icon: <Calendar  className="w-4 h-4 text-indigo-500" /> },
    { action: 'view',             label: 'View Details',            icon: <Eye       className="w-4 h-4 text-blue-500" /> },
    { action: 'convert',          label: 'Convert to Contact',      icon: <CheckSquare className="w-4 h-4 text-emerald-500" /> },
    ...(isAdmin ? [{ action: 'transfer', label: 'Transfer Lead',    icon: <ArrowRightLeft className="w-4 h-4 text-amber-500" /> }] : []),
    { action: 'add_owner',        label: 'Add Owner',               icon: <UserPlus  className="w-4 h-4 text-blue-500" /> },
    { action: 'remove_owner',     label: 'Remove Lead Owner',       icon: <Users     className="w-4 h-4 text-rose-400" /> },
    { action: 'add_cp',           label: 'Add Channel Partner',     icon: <Building2 className="w-4 h-4 text-indigo-500" /> },
    { action: 'remove_cp',        label: 'Remove Channel Partner',  icon: <Building2 className="w-4 h-4 text-rose-400" /> },
    { action: 'suggest_property', label: 'Suggested Property',      icon: <Building2 className="w-4 h-4 text-emerald-500" /> },
    { action: 'edit',             label: 'Edit Lead',               icon: <Edit3     className="w-4 h-4 text-slate-500" /> },
    ...(isAdmin ? [{ action: 'delete', label: 'Delete Lead',        icon: <Trash2    className="w-4 h-4 text-rose-500" />, danger: true }] : []),
  ];

  return createPortal(
    // Backdrop — tap to close
    <div
      className="mobile-action-sheet"
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}
      onClick={onClose}
    >
      {/* Card — stop propagation */}
      <div
        style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:340, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{lead.name}</div>
            <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{lead.leadId}</div>
          </div>
          <button onClick={onClose} style={{ padding:'4px 8px', borderRadius:6, background:'#f1f5f9', border:'none', fontSize:14, color:'#64748b', cursor:'pointer' }}>✕</button>
        </div>
        {/* Actions */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {items.map(({ action, label, icon, danger }) => (
            <button
              key={action}
              onClick={() => { handleRowAction(action, lead); onClose(); }}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%', padding:'12px 16px', background:'none', border:'none', borderBottom:'1px solid #f8fafc', cursor:'pointer', textAlign:'left', fontSize:13, fontWeight:500, color: danger ? '#ef4444' : '#1e293b', WebkitTapHighlightColor:'transparent' }}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MobileLeadCards({
  leads, loading, openMenuLeadId, setOpenMenuLeadId,
  onViewDetails, handleRowAction, isAdmin
}) {
  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Loading leads…</div>;
  if (!leads?.length) return <div className="py-12 text-center text-slate-400 text-sm">No leads found.</div>;

  const activeLead = leads.find(r => r.id === openMenuLeadId) ?? null;

  return (
    <>
      <div className="space-y-3 pb-4">
        {leads.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Tap body → View Details */}
            <button className="w-full text-left px-4 pt-3 pb-2 block" onClick={() => onViewDetails(r)}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-indigo-500 font-semibold">{r.leadId}</span>
                <span className="text-[10px] text-slate-400">{fmt(r.date)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                {r.inquiryCount > 1 && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Re-Inquiry ×{r.inquiryCount}</span>}
                {r.isConvertedToContact && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Contact</span>}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.primaryNo}</div>
              <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                {r.project      && <div><span className="text-slate-400">Project:</span> {r.project}</div>}
                {r.source       && <div><span className="text-slate-400">Source:</span> {r.source}</div>}
                {r.requirement  && <div className="line-clamp-1"><span className="text-slate-400">Req:</span> {r.requirement}</div>}
                {r.budget       && <div><span className="text-slate-400">Budget:</span> {r.budget}</div>}
                {r.preSalesAgent && <div><span className="text-slate-400">Agent:</span> {r.preSalesAgent}</div>}
              </div>
            </button>

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[r.status] || 'bg-blue-100 text-blue-700'}`}>{r.status}</span>
                {r.leadStage && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">{r.leadStage}</span>}
                {Array.isArray(r.tags) && r.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 text-slate-600">{tag}</span>
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenuLeadId(r.id); }}
                className="p-2 rounded-lg active:bg-slate-200 text-slate-500 flex-shrink-0 ml-2"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeLead && (
        <ActionSheet
          lead={activeLead}
          onClose={() => setOpenMenuLeadId(null)}
          handleRowAction={handleRowAction}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
