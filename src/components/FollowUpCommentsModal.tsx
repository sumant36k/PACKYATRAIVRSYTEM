import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  MessageSquarePlus,
  MessageSquareText,
  User,
  X,
} from 'lucide-react';
import {
  LEAD_STATUSES,
  LeadRecord,
  LeadStatus,
  formatLeadDate,
} from '../types/leads';

interface FollowUpCommentsModalProps {
  lead: LeadRecord | null;
  authToken: string | null;
  onUnauthorized: () => void;
  onLeadUpdated: (updated: LeadRecord) => void;
  onClose: () => void;
}

function statusBadgeClasses(status: LeadStatus): string {
  switch (status) {
    case 'New':
      return 'text-blue-700';
    case 'Contacted':
    case 'In Follow-Up':
    case 'Quoted':
      return 'text-amber-700';
    case 'Converted':
      return 'text-emerald-700';
    case 'Lost':
      return 'text-red-700';
    default:
      return 'text-slate-700';
  }
}

function formatCommentTimestamp(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNextFollowUp(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const FollowUpCommentsModal: React.FC<FollowUpCommentsModalProps> = ({
  lead,
  authToken,
  onUnauthorized,
  onLeadUpdated,
  onClose,
}) => {
  const [status, setStatus] = useState<LeadStatus>(lead?.status || 'In Follow-Up');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNextFollowUpDate('');
      setComment('');
      setError(null);
      setSavedNotice(null);
    }
  }, [lead?.id]);

  if (!lead) return null;

  const comments = Array.isArray(lead.followUpComments) ? lead.followUpComments : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setError('Please enter a follow-up comment before saving.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSavedNotice(null);

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          comment: trimmedComment,
          status,
          nextFollowUpDate: nextFollowUpDate.trim(),
        }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.lead) {
        setError(data?.detail || `Failed to save follow-up comment (HTTP ${res.status})`);
        return;
      }

      onLeadUpdated(data.lead);
      setComment('');
      setNextFollowUpDate('');
      setStatus(data.lead.status);
      setSavedNotice(`Saved follow-up update and set status to "${data.lead.status}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save follow-up comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 id="followup-modal-title" className="text-base font-semibold text-slate-900">
                Follow-Up Comments — <span className="font-mono tabular-nums">{lead.id}</span>
              </h3>
              <span className="text-xs font-medium text-slate-500">
                · <span className={lead.status === 'Converted' ? 'text-emerald-700' : lead.status === 'Lost' ? 'text-red-700' : 'text-blue-700'}>{lead.status}</span>
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span className="font-medium text-slate-900">{lead.name}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums">{lead.mobile}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>
                {lead.fromCity} &rarr; {lead.toCity}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close follow-up modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50/70 text-xs text-red-900 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {savedNotice && (
              <div
                role="status"
                className="px-3.5 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{savedNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="followup-status-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Current Lead Status
                </label>
                <select
                  id="followup-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                >
                  {LEAD_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="followup-next-date"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Next Follow-Up Date &amp; Time (Optional)
                </label>
                <input
                  id="followup-next-date"
                  type="datetime-local"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="followup-comment-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Follow-Up Comment *
              </label>
              <textarea
                id="followup-comment-input"
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Customer discussion summary, quote shared, callback requested, pickup readiness..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg whitespace-nowrap transition-colors"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                {submitting ? 'Saving...' : 'Save Follow-Up & Status'}
              </button>
            </div>
          </form>

          {/* Follow-Up History Timeline */}
          <div className="pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-blue-700" />
                Follow-Up History ({comments.length})
              </h4>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Created {formatLeadDate(lead.createdAt)}
              </span>
            </div>

            {comments.length === 0 ? (
              <div className="py-6 px-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-slate-500">
                No follow-up comments yet.
                {lead.notes ? (
                  <div className="mt-2 text-slate-600">
                    Initial notes: <span className="font-medium text-slate-800">{lead.notes}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <ol className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/40">
                {comments.map((item) => (
                  <li key={item.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {item.authorName}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className={`font-medium ${statusBadgeClasses(item.status).split(' ').find((c) => c.startsWith('text-')) || 'text-slate-700'}`}>
                          {item.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatCommentTimestamp(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {item.comment}
                    </p>

                    {item.nextFollowUpDate && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 font-mono tabular-nums">
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>Next Follow-Up: {formatNextFollowUp(item.nextFollowUpDate)}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
