import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, X, ChevronDown } from 'lucide-react';
import { crmApi } from '../api/crmApi';

const OUTCOMES = ['Connected', 'No Answer', 'Busy', 'Switched Off', 'Wrong Number', 'Call Back Later'];
const MAX_SECONDS = 4 * 60 * 60;

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function defaultFollowUpTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

/**
 * "How did the call go?" sheet. Everything except saving is optional:
 * the call itself is already recorded on the timeline when the worker tapped Call.
 */
const DETAIL_FIELDS = ['requirement', 'budget', 'subLocation', 'projectId'];
const EMPTY_DETAILS = { stage: '', stageReason: '', requirement: '', budget: '', subLocation: '', projectId: '' };

export default function CallLogSheet({ sheet, currentUserId, stages = [], projects = [], onClose, onSaved }) {
  // Lead details (stage + key fields), prefilled from the lead; only changed values are saved
  const [original, setOriginal] = useState(EMPTY_DETAILS);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [durationEdited, setDurationEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [linkedTask, setLinkedTask] = useState(null);
  const [completeChoice, setCompleteChoice] = useState(null); // null = follow the outcome default
  const [followUp, setFollowUp] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpWhen, setFollowUpWhen] = useState(defaultFollowUpTime());
  const [followUpType, setFollowUpType] = useState('CALL');
  const [saving, setSaving] = useState(false);

  // Reset whenever a new call opens the sheet
  useEffect(() => {
    if (!sheet) return;
    const total = sheet.durationSeconds;
    setOutcome('');
    setMinutes(total != null ? String(Math.floor(total / 60)) : '');
    setSeconds(total != null ? String(total % 60) : '');
    setDurationEdited(false);
    setNotes('');
    setCompleteChoice(null);
    setFollowUp(false);
    setFollowUpTitle(`Follow up with ${sheet.leadName}`);
    setFollowUpWhen(defaultFollowUpTime());
    setFollowUpType('CALL');
    setLinkedTask(null);
    const startDetails = { ...EMPTY_DETAILS, stage: sheet.leadStage || '' };
    setOriginal(startDetails);
    setDetails(startDetails);
    setDetailsLoaded(false);
    setShowMoreDetails(false);

    let cancelled = false;
    crmApi.getLeadDetails(sheet.leadId)
      .then((lead) => {
        if (cancelled || !lead) return;
        const loaded = {
          stage: lead.leadStage || '',
          stageReason: lead.stageReason || '',
          requirement: lead.requirement || '',
          budget: lead.budget || '',
          subLocation: lead.subLocation || '',
          projectId: lead.projectId != null ? String(lead.projectId) : '',
        };
        setOriginal(loaded);
        setDetails(loaded);
        setDetailsLoaded(true);
      })
      .catch(() => { if (!cancelled) setDetailsLoaded(true); });

    // Find an open CALL task that is due today or overdue
    crmApi.getLeadTasks(sheet.leadId)
      .then((tasks) => {
        if (cancelled) return;
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const open = (tasks || [])
          .filter((t) => t.activityType === 'CALL' && t.status !== 'Completed' && new Date(t.scheduleDate) <= endOfToday)
          .sort((a, b) => new Date(a.scheduleDate) - new Date(b.scheduleDate));
        setLinkedTask(open[0] || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sheet?.startedAt, sheet?.leadId]);

  if (!sheet) return null;

  const hasDuration = minutes !== '' || seconds !== '';
  const totalSeconds = hasDuration ? (parseInt(minutes || '0', 10) * 60 + parseInt(seconds || '0', 10)) : null;
  const durationInvalid = hasDuration && (Number.isNaN(totalSeconds) || totalSeconds < 0 || totalSeconds > MAX_SECONDS);
  const showEstimateTag = sheet.estimated && !durationEdited && hasDuration;
  const completeTask = !!linkedTask && (completeChoice ?? outcome === 'Connected');

  const stageDef = stages.find((s) => s.stage === details.stage);
  const stageReasons = stageDef?.allowedReasons || [];
  const stageChanged = !!details.stage && (details.stage !== original.stage || details.stageReason !== original.stageReason);
  const changedDetails = DETAIL_FIELDS.filter((f) => details[f] !== original[f]);
  const setDetail = (field, value) => setDetails((d) => ({ ...d, [field]: value }));
  // Stages in the catalog; keep the lead's current stage selectable even if it isn't in the list
  const stageOptions = stages.some((s) => s.stage === original.stage) || !original.stage
    ? stages.map((s) => s.stage)
    : [original.stage, ...stages.map((s) => s.stage)];

  const save = async () => {
    if (!outcome || durationInvalid || saving) return;
    setSaving(true);
    try {
      const payload = {
        outcome,
        durationSeconds: totalSeconds,
        durationIsEstimated: showEstimateTag,
        notes: notes.trim() || null,
        taskId: linkedTask ? linkedTask.id : null,
      };

      // The start request may still be in flight; wait briefly for its id so we update, not duplicate.
      let activityId = sheet.activityId;
      if (!activityId && sheet.startPromise) {
        const res = await Promise.race([sheet.startPromise, new Promise((r) => setTimeout(() => r(null), 3000))]);
        activityId = res?.activityId || null;
      }
      if (activityId) await crmApi.updateCall(sheet.leadId, activityId, payload);
      else await crmApi.logCall(sheet.leadId, payload);

      const problems = [];
      if (changedDetails.length) {
        try {
          const patch = {};
          changedDetails.forEach((f) => {
            patch[f] = f === 'projectId' ? (details.projectId ? Number(details.projectId) : null) : details[f].trim();
          });
          await crmApi.editLead(sheet.leadId, patch);
        } catch { problems.push('the lead details could not be updated'); }
      }
      if (stageChanged) {
        try {
          await crmApi.changeStage(sheet.leadId, {
            stage: details.stage,
            stageReason: details.stageReason || null,
            agentId: currentUserId,
            completeOpenTasks: false, // the checkbox below decides which task gets completed
          });
        } catch { problems.push('the stage could not be updated'); }
      }
      if (completeTask) {
        try {
          await crmApi.completeTask(linkedTask.id, {
            completedById: currentUserId,
            outcomeRemark: `Call: ${outcome}${notes.trim() ? ` - ${notes.trim()}` : ''}`,
          });
        } catch { problems.push('the task could not be marked complete'); }
      }
      if (followUp && followUpWhen) {
        try {
          await crmApi.addTask(sheet.leadId, {
            assignedById: currentUserId,
            assignedToId: currentUserId,
            scheduleDate: new Date(followUpWhen).toISOString(),
            title: followUpTitle.trim() || `Follow up with ${sheet.leadName}`,
            remark: '',
            activityType: followUpType,
            stage: details.stage || sheet.leadStage || 'New Lead',
          });
        } catch { problems.push('the follow-up task could not be created'); }
      }

      if (problems.length) alert(`Call saved, but ${problems.join(' and ')}.`);
      onSaved?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.title || err.response?.data || 'Could not save the call. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 truncate">{sheet.leadName}</div>
              <div className="text-[11px] text-slate-500 font-mono">{sheet.phone}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3.5 text-xs">
          <p className="text-[11px] text-slate-500">
            {sheet.manual ? 'Log a call you made outside the CRM.' : 'This call is already recorded on the timeline. Add details if you like.'}
          </p>

          {/* Lead details: stage + key fields */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2" data-testid="call-lead-details">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700">Lead</span>
              {!detailsLoaded && <span className="text-[10px] text-slate-400">Loading…</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Stage</label>
                <select
                  value={details.stage}
                  onChange={(e) => {
                    const st = stages.find((s) => s.stage === e.target.value);
                    setDetails((d) => ({
                      ...d,
                      stage: e.target.value,
                      stageReason: e.target.value === original.stage ? original.stageReason : (st?.allowedReasons?.[0] || ''),
                    }));
                  }}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                >
                  {!details.stage && <option value="">Select stage</option>}
                  {stageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Reason</label>
                <select
                  value={details.stageReason}
                  onChange={(e) => setDetail('stageReason', e.target.value)}
                  disabled={stageReasons.length === 0 && !details.stageReason}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {(stageReasons.length === 0 || !stageReasons.includes(details.stageReason)) && (
                    <option value={details.stageReason}>{details.stageReason || '—'}</option>
                  )}
                  {stageReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMoreDetails((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-indigo-600"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`} />
              {showMoreDetails ? 'Hide details' : 'More details'}
              {changedDetails.length > 0 && !showMoreDetails && (
                <span className="ml-1 px-1.5 rounded bg-indigo-100 text-indigo-700 text-[10px]">{changedDetails.length} edited</span>
              )}
            </button>

            {showMoreDetails && (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Project</label>
                  <select
                    value={details.projectId}
                    onChange={(e) => setDetail('projectId', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                  >
                    <option value="">Not set</option>
                    {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Requirement</label>
                  <input
                    type="text" value={details.requirement} maxLength={500}
                    onChange={(e) => setDetail('requirement', e.target.value)}
                    placeholder="e.g. 2 BHK"
                    className="w-full border border-slate-300 rounded px-2 py-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Budget</label>
                    <input
                      type="text" value={details.budget} maxLength={100}
                      onChange={(e) => setDetail('budget', e.target.value)}
                      placeholder="e.g. 1.2 Cr"
                      className="w-full border border-slate-300 rounded px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Location</label>
                    <input
                      type="text" value={details.subLocation} maxLength={200}
                      onChange={(e) => setDetail('subLocation', e.target.value)}
                      placeholder="e.g. Thane West"
                      className="w-full border border-slate-300 rounded px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">How did it go?</label>
            <div className="grid grid-cols-2 gap-1.5">
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={`px-2 py-2 rounded-lg border text-xs font-medium transition ${
                    outcome === o ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Duration <span className="font-normal text-slate-400">(optional)</span>
              {showEstimateTag && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">≈ estimated</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" inputMode="numeric" placeholder="min" value={minutes}
                onChange={(e) => { setMinutes(e.target.value); setDurationEdited(true); }}
                className="w-20 border border-slate-300 rounded px-2.5 py-1.5"
              />
              <span className="text-slate-400">:</span>
              <input
                type="number" min="0" max="59" inputMode="numeric" placeholder="sec" value={seconds}
                onChange={(e) => { setSeconds(e.target.value); setDurationEdited(true); }}
                className="w-20 border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
            {sheet.estimated && !durationEdited && (
              <p className="text-[10px] text-slate-400 mt-1">Time since you tapped Call. It includes dialing and ringing, so adjust if needed.</p>
            )}
            {durationInvalid && <p className="text-[11px] text-rose-600 mt-1">Duration must be between 0 and 4 hours.</p>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What was discussed?"
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 resize-none"
            />
          </div>

          {linkedTask && (
            <label className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 cursor-pointer">
              <input
                type="checkbox" className="mt-0.5" checked={completeTask}
                onChange={(e) => setCompleteChoice(e.target.checked)}
              />
              <span className="text-[11px] text-slate-600">
                Mark task complete: <span className="font-semibold text-slate-800">{linkedTask.title}</span>
              </span>
            </label>
          )}

          <div className="border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
              <span className="text-[11px] font-semibold text-slate-700">Schedule a follow-up</span>
            </label>
            {followUp && (
              <div className="mt-2 space-y-2">
                <input
                  type="text" value={followUpTitle} onChange={(e) => setFollowUpTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local" value={followUpWhen} onChange={(e) => setFollowUpWhen(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                  <select
                    value={followUpType} onChange={(e) => setFollowUpType(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  >
                    <option value="CALL">CALL</option>
                    <option value="SITE VISIT">SITE VISIT</option>
                    <option value="MEETING">MEETING</option>
                    <option value="WHATSAPP">WHATSAPP</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-200 flex-shrink-0">
          <button
            type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            {sheet.manual ? 'Cancel' : 'Skip'}
          </button>
          <button
            type="button" onClick={save} disabled={!outcome || durationInvalid || saving}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
