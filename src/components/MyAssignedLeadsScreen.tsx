import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { AuthUser } from '../types/exotel';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LeadRecord,
  LeadStatus,
  MOVE_TYPES,
  SupportRep,
  formatLeadDate,
} from '../types/leads';
import { FollowUpCommentsModal } from './FollowUpCommentsModal';

interface MyAssignedLeadsScreenProps {
  authToken: string | null;
  authUser: AuthUser;
  onUnauthorized: () => void;
  onDialNumber: (phoneNumber: string) => void;
}

function statusSelectStyle(status: LeadStatus): string {
  switch (status) {
    case 'New':
      return 'bg-blue-50/80 border-blue-200 text-blue-700';
    case 'Contacted':
    case 'In Follow-Up':
    case 'Quoted':
      return 'bg-amber-50/80 border-amber-200 text-amber-800';
    case 'Converted':
      return 'bg-emerald-50/80 border-emerald-200 text-emerald-700';
    case 'Lost':
      return 'bg-red-50/80 border-red-200 text-red-700';
    default:
      return 'bg-white border-slate-200 text-slate-700';
  }
}

export const MyAssignedLeadsScreen: React.FC<MyAssignedLeadsScreenProps> = ({
  authToken,
  authUser,
  onUnauthorized,
  onDialNumber,
}) => {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [reps, setReps] = useState<SupportRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [moveTypeFilter, setMoveTypeFilter] = useState<string>('all');

  // Follow-Up Comments Modal
  const [followUpLead, setFollowUpLead] = useState<LeadRecord | null>(null);

  // Book Ticket Modal
  const [ticketLead, setTicketLead] = useState<LeadRecord | null>(null);
  const [ticketAmount, setTicketAmount] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const fetchAssignedLeads = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.detail || `Failed to load assigned leads (HTTP ${res.status})`);
      } else {
        setLeads(Array.isArray(data?.leads) ? data.leads : []);
        setReps(Array.isArray(data?.reps) ? data.reps : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assigned leads.');
    } finally {
      setLoading(false);
    }
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    fetchAssignedLeads();
  }, [fetchAssignedLeads]);

  const currentRepId = useMemo(() => {
    const first = authUser.firstName.trim().toLowerCase();
    const email = (authUser.email || '').trim().toLowerCase();
    const match = reps.find(
      (r) =>
        r.name.toLowerCase() === first ||
        r.name.toLowerCase().split(' ')[0] === first ||
        (email && r.email.toLowerCase() === email)
    );
    return match?.id || '';
  }, [reps, authUser]);

  const myLeads = useMemo(() => {
    if (!currentRepId) return [];
    return leads.filter((l) => l.assignedRepId === currentRepId);
  }, [leads, currentRepId]);

  const kpis = useMemo(() => {
    const total = myLeads.length;
    const newCount = myLeads.filter((l) => l.status === 'New').length;
    const followUpCount = myLeads.filter(
      (l) => l.status === 'Contacted' || l.status === 'In Follow-Up' || l.status === 'Quoted'
    ).length;
    const convertedCount = myLeads.filter((l) => l.status === 'Converted').length;
    const convertedPct = total > 0 ? Math.round((convertedCount / total) * 100) : 0;
    return { total, newCount, followUpCount, convertedCount, convertedPct };
  }, [myLeads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myLeads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      if (moveTypeFilter !== 'all' && lead.moveType !== moveTypeFilter) return false;
      if (!q) return true;
      return (
        lead.id.toLowerCase().includes(q) ||
        lead.name.toLowerCase().includes(q) ||
        lead.mobile.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.fromCity.toLowerCase().includes(q) ||
        lead.toCity.toLowerCase().includes(q) ||
        lead.requirement.toLowerCase().includes(q)
      );
    });
  }, [myLeads, search, statusFilter, sourceFilter, moveTypeFilter]);

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    if (!authToken) return;
    setSavingId(leadId);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.lead) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleLeadUpdatedFromFollowUp = (updated: LeadRecord) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setFollowUpLead(updated);
    setNotice(`Added follow-up comment on ${updated.id} (Status: ${updated.status}).`);
  };

  const handleOpenBookTicket = (lead: LeadRecord) => {
    setTicketLead(lead);
    setTicketAmount(lead.quotedAmount || '');
    setTicketNotes(lead.notes || '');
  };

  const handleConfirmBookTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !ticketLead) return;
    setTicketSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(ticketLead.id)}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          quotedAmount: ticketAmount.trim(),
          notes: ticketNotes.trim(),
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.lead) {
        setLeads((prev) => prev.map((l) => (l.id === ticketLead.id ? data.lead : l)));
        setNotice(
          `Converted ${data.lead.id} (${data.lead.name}) into booking ticket ${data.lead.ticketId}.`
        );
        setTicketLead(null);
      }
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            My Assigned Leads
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Follow up on leads assigned to you, log call remarks, and convert inquiries into booking tickets.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAssignedLeads}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unified 4-Column Corporate KPI Strip */}
      <section
        aria-label="My assigned leads summary"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Assigned Leads</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1.5">
            {kpis.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">Assigned to your queue</div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">New / Uncontacted</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-blue-700 mt-1.5">
            {kpis.newCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Ready for initial callback</div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">In Follow-Up / Quoted</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-amber-700 mt-1.5">
            {kpis.followUpCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Active sales discussions</div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Converted Bookings</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-semibold font-mono tabular-nums text-emerald-700">
              {kpis.convertedCount}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {kpis.convertedPct}% rate
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Confirmed booking tickets</div>
        </div>
      </section>

      {/* Search, Filters & Assigned Leads Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0 lg:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, Mobile, Email, City, or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            >
              <option value="all">All Statuses</option>
              {LEAD_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            >
              <option value="all">All Sources</option>
              {LEAD_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Move Type"
              value={moveTypeFilter}
              onChange={(e) => setMoveTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            >
              <option value="all">All Move Types</option>
              {MOVE_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {mt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-8 text-center">
            <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-900">
              Unable to load assigned leads
            </div>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchAssignedLeads}
              className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!error && loading && myLeads.length === 0 && (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-8 w-28 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && filteredLeads.length === 0 && (
          <div className="py-14 px-6 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 mb-3">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              {myLeads.length === 0
                ? 'No leads assigned yet'
                : 'No matching assigned leads found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {myLeads.length === 0
                ? 'Leads assigned to you by an administrator will appear here.'
                : 'Try adjusting your search or filter selections.'}
            </p>
          </div>
        )}

        {!error && filteredLeads.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">Lead ID</th>
                  <th className="py-3 px-3 whitespace-nowrap">Customer Details</th>
                  <th className="py-3 px-3 whitespace-nowrap">Shifting Route</th>
                  <th className="py-3 px-3 whitespace-nowrap">Requirement</th>
                  <th className="py-3 px-3 whitespace-nowrap">Follow-Up</th>
                  <th className="py-3 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLeads.map((lead) => {
                  const isSaving = savingId === lead.id;
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-5 pr-3 align-top whitespace-nowrap">
                        <div className="text-xs font-semibold font-mono tabular-nums text-slate-900">
                          {lead.id}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                          {formatLeadDate(lead.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top">
                        <div className="font-semibold text-slate-900 whitespace-nowrap">
                          {lead.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono tabular-nums mt-1 whitespace-nowrap">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{lead.mobile}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
                          <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span>
                            {lead.fromCity} &rarr; {lead.toCity}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className={lead.moveType === 'Local' ? 'text-emerald-700 font-medium' : 'text-blue-700 font-medium'}>
                            {lead.moveType}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{lead.source}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800 whitespace-nowrap">
                          <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{lead.requirement}</span>
                        </div>
                        {lead.quotedAmount && (
                          <div className="text-[11px] font-mono tabular-nums text-emerald-700 mt-1">
                            Quote: {lead.quotedAmount}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 align-top max-w-[240px]">
                        {(() => {
                          const comments = lead.followUpComments || [];
                          const latest = comments[0];
                          const preview = latest?.comment || lead.notes;
                          return (
                            <button
                              type="button"
                              onClick={() => setFollowUpLead(lead)}
                              className="text-left text-xs text-slate-600 hover:text-slate-900 inline-flex items-start gap-1.5 group"
                            >
                              <MessageSquareText className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="line-clamp-2 group-hover:underline">
                                  {preview ? preview : 'Add follow-up comment...'}
                                </span>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                                  <span>
                                    {comments.length}{' '}
                                    {comments.length === 1 ? 'update' : 'updates'}
                                  </span>
                                  {latest?.nextFollowUpDate && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-700">
                                        Next {formatLeadDate(latest.nextFollowUpDate)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <select
                          aria-label={`Status for ${lead.name}`}
                          disabled={isSaving}
                          value={lead.status}
                          onChange={(e) =>
                            handleStatusChange(lead.id, e.target.value as LeadStatus)
                          }
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${statusSelectStyle(
                            lead.status
                          )}`}
                        >
                          {LEAD_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 pl-3 pr-5 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFollowUpLead(lead)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <MessageSquareText className="w-3.5 h-3.5 text-blue-700" />
                            Follow-Up
                          </button>

                          {lead.status === 'Converted' && lead.ticketId ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold font-mono tabular-nums text-emerald-700">
                              <Ticket className="w-3.5 h-3.5" />
                              {lead.ticketId}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenBookTicket(lead)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Ticket className="w-3.5 h-3.5" />
                              Book Ticket
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDialNumber(lead.mobile)}
                            title={`Call ${lead.mobile}`}
                            aria-label={`Call ${lead.name}`}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <PhoneCall className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FollowUpCommentsModal
        lead={followUpLead}
        authToken={authToken}
        onUnauthorized={onUnauthorized}
        onLeadUpdated={handleLeadUpdatedFromFollowUp}
        onClose={() => setFollowUpLead(null)}
      />

      {/* Book Ticket Modal */}
      {ticketLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="my-ticket-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-lg">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <h3 id="my-ticket-modal-title" className="text-base font-semibold text-slate-900">
                Convert {ticketLead.id} to Booking Ticket
              </h3>
              <button
                type="button"
                onClick={() => setTicketLead(null)}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBookTicket} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-slate-900">{ticketLead.name}</div>
                <div className="text-slate-600 font-mono tabular-nums">{ticketLead.mobile}</div>
                <div className="text-slate-600">
                  {ticketLead.fromCity} &rarr; {ticketLead.toCity} · {ticketLead.requirement}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirmed Quote Amount (Optional)
                </label>
                <input
                  type="text"
                  value={ticketAmount}
                  onChange={(e) => setTicketAmount(e.target.value)}
                  placeholder="e.g. ₹8,500"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Booking Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={ticketNotes}
                  onChange={(e) => setTicketNotes(e.target.value)}
                  placeholder="Pickup slot, advance received, etc."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTicketLead(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  {ticketSubmitting ? 'Booking...' : 'Confirm Booking Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
