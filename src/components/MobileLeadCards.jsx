import { useState, useEffect, useRef } from 'react';
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

// Renders a full-screen overlay menu so it's never clipped by overflow or viewport edge
function ActionMenu({ r, onClose, handleRowAction, isAdmin }) {
  return (
    <>
      {/* Backdrop — tap outside to close */}
      <div
        className="fixed inset-0 z-40"
        onTouchStart={onClose}
        onClick={onClose}
      />
      {/* Menu sheet — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl pb-safe">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-semibold text-slate-800 text-sm">{r.name}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
        </div>
        <div className="overflow-y-auto max-h-72">
          <button onTouchEnd={() => { handleRowAction('add_task', r); onClose(); }} onClick={() => { handleRowAction('add_task', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" /> Add Task / Update Stage
          </button>
          <button onTouchEnd={() => { handleRowAction('view', r); onClose(); }} onClick={() => { handleRowAction('view', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Eye className="w-4 h-4 text-blue-600 flex-shrink-0" /> View Details
          </button>
          <button onTouchEnd={() => { handleRowAction('convert', r); onClose(); }} onClick={() => { handleRowAction('convert', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" /> Convert to Contact
          </button>
          {isAdmin && (
            <button onTouchEnd={() => { handleRowAction('transfer', r); onClose(); }} onClick={() => { handleRowAction('transfer', r); onClose(); }}
              className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
              <ArrowRightLeft className="w-4 h-4 text-amber-600 flex-shrink-0" /> Transfer Lead
            </button>
          )}
          <button onTouchEnd={() => { handleRowAction('add_owner', r); onClose(); }} onClick={() => { handleRowAction('add_owner', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" /> Add Owner
          </button>
          <button onTouchEnd={() => { handleRowAction('remove_owner', r); onClose(); }} onClick={() => { handleRowAction('remove_owner', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Users className="w-4 h-4 text-rose-500 flex-shrink-0" /> Remove Lead Owner
          </button>
          <button onTouchEnd={() => { handleRowAction('add_cp', r); onClose(); }} onClick={() => { handleRowAction('add_cp', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" /> Add Channel Partner
          </button>
          <button onTouchEnd={() => { handleRowAction('remove_cp', r); onClose(); }} onClick={() => { handleRowAction('remove_cp', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Building2 className="w-4 h-4 text-rose-500 flex-shrink-0" /> Remove Channel Partner
          </button>
          <button onTouchEnd={() => { handleRowAction('suggest_property', r); onClose(); }} onClick={() => { handleRowAction('suggest_property', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> Suggested Property
          </button>
          <button onTouchEnd={() => { handleRowAction('edit', r); onClose(); }} onClick={() => { handleRowAction('edit', r); onClose(); }}
            className="w-full px-4 py-3.5 hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-700 border-b border-slate-50">
            <Edit3 className="w-4 h-4 text-slate-600 flex-shrink-0" /> Edit Lead
          </button>
          {isAdmin && (
            <button onTouchEnd={() => { handleRowAction('delete', r); onClose(); }} onClick={() => { handleRowAction('delete', r); onClose(); }}
              className="w-full px-4 py-3.5 hover:bg-rose-50 flex items-center gap-3 text-sm text-rose-600">
              <Trash2 className="w-4 h-4 flex-shrink-0" /> Delete Lead
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function MobileLeadCards({
  leads, loading, openMenuLeadId, setOpenMenuLeadId,
  onViewDetails, handleRowAction, isAdmin
}) {
  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Loading leads…</div>;
  if (!leads?.length) return <div className="py-12 text-center text-slate-400 text-sm">No leads found.</div>;

  const activeMenuLead = leads.find(r => r.id === openMenuLeadId) || null;

  return (
    <>
      <div className="space-y-3">
        {leads.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
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
                {r.project    && <div><span className="text-slate-400">Project:</span> {r.project}</div>}
                {r.source     && <div><span className="text-slate-400">Source:</span> {r.source}</div>}
                {r.requirement && <div className="line-clamp-1"><span className="text-slate-400">Req:</span> {r.requirement}</div>}
                {r.budget     && <div><span className="text-slate-400">Budget:</span> {r.budget}</div>}
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
              {/* Kebab — opens bottom sheet */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuLeadId(r.id);
                }}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 flex-shrink-0 ml-2"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom sheet action menu — rendered outside card list to avoid clipping */}
      {activeMenuLead && (
        <ActionMenu
          r={activeMenuLead}
          onClose={() => setOpenMenuLeadId(null)}
          handleRowAction={handleRowAction}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
