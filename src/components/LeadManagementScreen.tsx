import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileInput,
  Headphones,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LeadRecord,
  LeadSource,
  LeadStatus,
  MOVE_TYPES,
  MoveType,
  SupportRep,
  formatLeadDate,
} from '../types/leads';
import { parsePortalAlertText } from '../utils/leadParser';
import { FollowUpCommentsModal } from './FollowUpCommentsModal';

interface LeadManagementScreenProps {
  authToken: string | null;
  onUnauthorized: () => void;
  onDialNumber: (phoneNumber: string) => void;
}

interface LeadFormState {
  id?: string;
  name: string;
  mobile: string;
  email: string;
  fromCity: string;
  toCity: string;
  moveType: MoveType;
  requirement: string;
  source: LeadSource;
  assignedRepId: string;
  status: LeadStatus;
  notes: string;
}

const EMPTY_FORM: LeadFormState = {
  name: '',
  mobile: '',
  email: '',
  fromCity: '',
  toCity: '',
  moveType: 'Local',
  requirement: '',
  source: 'LogisticMart',
  assignedRepId: '',
  status: 'New',
  notes: '',
};

function sanitizeCsvCell(value: string): string {
  const str = String(value || '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
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

export const LeadManagementScreen: React.FC<LeadManagementScreenProps> = ({
  authToken,
  onUnauthorized,
  onDialNumber,
}) => {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [reps, setReps] = useState<SupportRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Quick Import Portal Lead
  const [portalAlertText, setPortalAlertText] = useState('');
  const [importing, setImporting] = useState(false);

  // Table Filters
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [moveTypeFilter, setMoveTypeFilter] = useState<string>('all');

  // Add / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<LeadFormState>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Book Ticket Modal
  const [ticketLead, setTicketLead] = useState<LeadRecord | null>(null);
  const [ticketAmount, setTicketAmount] = useState('');
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  // Follow-Up Comments Modal
  const [followUpLead, setFollowUpLead] = useState<LeadRecord | null>(null);

  const fetchLeads = useCallback(async () => {
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
        setError(data?.detail || `Failed to load leads (HTTP ${res.status})`);
      } else {
        setLeads(Array.isArray(data?.leads) ? data.leads : []);
        setReps(Array.isArray(data?.reps) ? data.reps : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leads.');
    } finally {
      setLoading(false);
    }
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((l) => l.status === 'New').length;
    const followUpCount = leads.filter(
      (l) => l.status === 'Contacted' || l.status === 'In Follow-Up' || l.status === 'Quoted'
    ).length;
    const convertedCount = leads.filter((l) => l.status === 'Converted').length;
    const convertedPct = total > 0 ? Math.round((convertedCount / total) * 100) : 0;
    return { total, newCount, followUpCount, convertedCount, convertedPct };
  }, [leads]);

  const repMetrics = useMemo(() => {
    const unassignedLeads = leads.filter((l) => !l.assignedRepId);
    const unassignedNew = unassignedLeads.filter((l) => l.status === 'New').length;

    const perRep = reps.map((rep) => {
      const repLeads = leads.filter((l) => l.assignedRepId === rep.id);
      return {
        ...rep,
        total: repLeads.length,
        newCount: repLeads.filter((l) => l.status === 'New').length,
        activeCount: repLeads.filter(
          (l) => l.status === 'Contacted' || l.status === 'In Follow-Up' || l.status === 'Quoted'
        ).length,
        convertedCount: repLeads.filter((l) => l.status === 'Converted').length,
      };
    });

    return {
      unassignedTotal: unassignedLeads.length,
      unassignedNew,
      perRep,
    };
  }, [leads, reps]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (repFilter === 'unassigned' && lead.assignedRepId) return false;
      if (repFilter !== 'all' && repFilter !== 'unassigned' && lead.assignedRepId !== repFilter) {
        return false;
      }
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
  }, [leads, search, repFilter, statusFilter, sourceFilter, moveTypeFilter]);

  const handleExportExcel = () => {
    const repMap = new Map(reps.map((r) => [r.id, r.name]));
    const headers = [
      'Lead ID',
      'Created Date',
      'Name',
      'Mobile',
      'Email',
      'From City',
      'To City',
      'Move Type',
      'Requirement',
      'Source',
      'Assigned Support',
      'Status',
      'Ticket ID',
      'Quoted Amount',
      'Follow-Up Count',
      'Latest Follow-Up',
    ];
    const rows = filteredLeads.map((l) => {
      const comments = l.followUpComments || [];
      const latestComment = comments[0]?.comment || l.notes || '';
      return [
        l.id,
        formatLeadDate(l.createdAt),
        l.name,
        l.mobile,
        l.email,
        l.fromCity,
        l.toCity,
        l.moveType,
        l.requirement,
        l.source,
        l.assignedRepId ? repMap.get(l.assignedRepId) || '' : 'Unassigned',
        l.status,
        l.ticketId || '',
        l.quotedAmount || '',
        String(comments.length),
        latestComment,
      ]
        .map(sanitizeCsvCell)
        .join(',');
    });
    const csv = `\uFEFF${[headers.join(','), ...rows].join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packyatra_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuickParseAndSave = async () => {
    if (!authToken) return;
    const raw = portalAlertText.trim();
    if (!raw) {
      setBannerNotice({
        type: 'error',
        text: 'Paste a portal lead alert message first to parse and save.',
      });
      return;
    }

    const parsed = parsePortalAlertText(raw);
    if (!parsed.name || !parsed.mobile) {
      setFormState({
        ...EMPTY_FORM,
        ...parsed,
      });
      setFormError('Could not detect both Name and Mobile automatically. Review and complete below.');
      setFormOpen(true);
      return;
    }

    setImporting(true);
    setBannerNotice(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...parsed,
          assignedRepId: '',
          status: 'New',
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBannerNotice({
          type: 'error',
          text: data?.detail || 'Failed to save parsed lead.',
        });
        return;
      }
      setLeads((prev) => [data.lead, ...prev]);
      setPortalAlertText('');
      setBannerNotice({
        type: 'success',
        text: `Imported ${data.lead.id} (${data.lead.name}) from ${data.lead.source}.`,
      });
    } catch (err) {
      setBannerNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save lead.',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReviewInForm = () => {
    const raw = portalAlertText.trim();
    if (!raw) {
      setFormState(EMPTY_FORM);
    } else {
      const parsed = parsePortalAlertText(raw);
      setFormState({
        ...EMPTY_FORM,
        ...parsed,
      });
    }
    setFormError(null);
    setFormOpen(true);
  };

  const handleOpenAddModal = () => {
    setFormState(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const handleOpenEditModal = (lead: LeadRecord) => {
    setFormState({
      id: lead.id,
      name: lead.name,
      mobile: lead.mobile,
      email: lead.email,
      fromCity: lead.fromCity,
      toCity: lead.toCity,
      moveType: lead.moveType,
      requirement: lead.requirement,
      source: lead.source,
      assignedRepId: lead.assignedRepId,
      status: lead.status,
      notes: lead.notes || '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    if (!formState.name.trim() || !formState.mobile.trim()) {
      setFormError('Customer name and mobile number are required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const isEdit = Boolean(formState.id);
      const url = isEdit ? `/api/leads/${encodeURIComponent(formState.id!)}` : '/api/leads';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: formState.name.trim(),
          mobile: formState.mobile.trim(),
          email: formState.email.trim(),
          fromCity: formState.fromCity.trim() || 'Bangalore',
          toCity: formState.toCity.trim() || formState.fromCity.trim() || 'Bangalore',
          moveType: formState.moveType,
          requirement: formState.requirement.trim() || 'Household Shifting',
          source: formState.source,
          assignedRepId: formState.assignedRepId,
          status: formState.status,
          notes: formState.notes.trim(),
        }),
      });

      if (res.status === 401) {
        onUnauthorized();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data?.detail || `Request failed (HTTP ${res.status})`);
        return;
      }

      if (isEdit) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)));
        setBannerNotice({ type: 'success', text: `Updated lead ${data.lead.id}.` });
      } else {
        setLeads((prev) => [data.lead, ...prev]);
        setPortalAlertText('');
        setBannerNotice({ type: 'success', text: `Added new lead ${data.lead.id} (${data.lead.name}).` });
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save lead.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleInlineUpdate = async (
    leadId: string,
    patch: { assignedRepId?: string; status?: LeadStatus }
  ) => {
    if (!authToken) return;
    setSavingId(leadId);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(patch),
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
        setBannerNotice({
          type: 'success',
          text: `Converted ${data.lead.id} (${data.lead.name}) into booking ticket ${data.lead.ticketId}.`,
        });
        setTicketLead(null);
      }
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleLeadUpdatedFromFollowUp = (updated: LeadRecord) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setFollowUpLead(updated);
    setBannerNotice({
      type: 'success',
      text: `Added follow-up comment on ${updated.id} (Status: ${updated.status}).`,
    });
  };

  const handleDeleteLead = async (lead: LeadRecord) => {
    if (!authToken) return;
    setSavingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id));
        setBannerNotice({ type: 'success', text: `Removed lead ${lead.id}.` });
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Lead Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage inbound portal inquiries, assign Customer Support representatives, and convert leads to booking tickets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchLeads}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredLeads.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add New Lead
          </button>
        </div>
      </div>

      {bannerNotice && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-red-50/70 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{bannerNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            aria-label="Dismiss notice"
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unified 4-Column Corporate KPI Strip */}
      <section
        aria-label="Lead pipeline summary"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total Leads</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1.5">
            {kpis.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">All portal &amp; direct inquiries</div>
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

      {/* Customer Support Allocation */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-blue-700 shrink-0" />
              Customer Support Allocation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any team card to filter the pipeline table by representative.
            </p>
          </div>
          {repFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setRepFilter('all')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap self-start sm:self-auto"
            >
              Show All Reps
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Unassigned Card */}
          <button
            type="button"
            onClick={() =>
              setRepFilter((prev) => (prev === 'unassigned' ? 'all' : 'unassigned'))
            }
            className={`text-left p-4 rounded-xl border transition-colors ${
              repFilter === 'unassigned'
                ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/15'
                : 'border-slate-200 bg-white hover:bg-slate-50/80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  Unassigned Leads
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  Pending assignment
                </div>
              </div>
              <span className="text-xl font-semibold font-mono tabular-nums text-amber-700 shrink-0">
                {repMetrics.unassignedTotal}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
              <span>New {repMetrics.unassignedNew}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-sans text-slate-500">Ready to assign</span>
            </div>
          </button>

          {/* Rep Cards */}
          {repMetrics.perRep.map((rep) => {
            const selected = repFilter === rep.id;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => setRepFilter((prev) => (prev === rep.id ? 'all' : rep.id))}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  selected
                    ? 'border-blue-700 bg-blue-50/40 ring-2 ring-blue-600/15'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {rep.name}{' '}
                      {!rep.active && (
                        <span className="text-xs font-medium text-red-600">(Inactive)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{rep.email}</div>
                  </div>
                  <span className="text-xl font-semibold font-mono tabular-nums text-blue-700 shrink-0">
                    {rep.total}
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
                  <span>New {rep.newCount}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Active {rep.activeCount}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Won {rep.convertedCount}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Import Portal Lead */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-700 shrink-0" />
            Quick Import Portal Lead
          </h3>
          <span className="text-xs text-slate-500">
            Paste LogisticMart, SMS, or email alert text to auto-extract customer, route, and source fields.
          </span>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <input
            type="text"
            value={portalAlertText}
            onChange={(e) => setPortalAlertText(e.target.value)}
            placeholder="e.g. Name Rahul Sharma Mobile no 9876543210 Email Id rahul.sharma@example.com Shifting From Pune To Mumbai Need 2 BHK Household"
            className="flex-1 px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={importing}
              onClick={handleQuickParseAndSave}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileInput className="w-3.5 h-3.5" />
              {importing ? 'Saving...' : 'Parse & Save Lead'}
            </button>
            <button
              type="button"
              onClick={handleReviewInForm}
              className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Review in Form
            </button>
          </div>
        </div>
      </section>

      {/* Filter Bar & Leads Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0 xl:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, Mobile, Email, City, Requirement, or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by Customer Support"
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            >
              <option value="all">All Customer Support</option>
              <option value="unassigned">Unassigned Leads</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

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
            <div className="text-sm font-semibold text-slate-900">Unable to load leads</div>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchLeads}
              className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!error && loading && leads.length === 0 && (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-4 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-8 w-32 bg-slate-200 rounded" />
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
              {leads.length === 0 ? 'No leads added yet' : 'No matching leads found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {leads.length === 0
                ? 'Paste a portal alert above or click Add New Lead to create your first inquiry.'
                : 'Try clearing your search or resetting the filters.'}
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
                  <th className="py-3 px-3 whitespace-nowrap">Assigned Support</th>
                  <th className="py-3 px-3 whitespace-nowrap">Follow-Up</th>
                  <th className="py-3 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLeads.map((lead) => {
                  const isSaving = savingId === lead.id;
                  const isUnassigned = !lead.assignedRepId;
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* LEAD ID */}
                      <td className="py-3 pl-5 pr-3 align-top whitespace-nowrap">
                        <div className="text-xs font-semibold font-mono tabular-nums text-slate-900">
                          {lead.id}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
                          {formatLeadDate(lead.createdAt)}
                        </div>
                      </td>

                      {/* CUSTOMER DETAILS */}
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

                      {/* SHIFTING ROUTE */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900">
                          <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span>
                            {lead.fromCity} &rarr; {lead.toCity}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span
                            className={
                              lead.moveType === 'Local'
                                ? 'text-emerald-700 font-medium'
                                : 'text-blue-700 font-medium'
                            }
                          >
                            {lead.moveType}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{lead.source}</span>
                        </div>
                      </td>

                      {/* REQUIREMENT / NEED */}
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

                      {/* ASSIGNED CUSTOMER SUPPORT */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <select
                          aria-label={`Assign support rep for ${lead.name}`}
                          disabled={isSaving}
                          value={lead.assignedRepId}
                          onChange={(e) =>
                            handleInlineUpdate(lead.id, { assignedRepId: e.target.value })
                          }
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                            isUnassigned
                              ? 'bg-amber-50/70 border-amber-300 text-amber-800'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="">-- Unassigned --</option>
                          {reps.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                              {!r.active ? ' (Inactive)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* FOLLOW-UP COMMENTS */}
                      <td className="py-3 px-3 align-top max-w-[220px]">
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
                                  {preview ? preview : 'Add follow-up...'}
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

                      {/* STATUS */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <select
                          aria-label={`Status for ${lead.name}`}
                          disabled={isSaving}
                          value={lead.status}
                          onChange={(e) =>
                            handleInlineUpdate(lead.id, {
                              status: e.target.value as LeadStatus,
                            })
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

                      {/* ACTIONS */}
                      <td className="py-3 pl-3 pr-5 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFollowUpLead(lead)}
                            title={`Follow-up comments for ${lead.name}`}
                            aria-label={`Follow-up comments for ${lead.name}`}
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

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(lead)}
                            title="Edit lead"
                            aria-label={`Edit ${lead.name}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDeleteLead(lead)}
                            title="Delete lead"
                            aria-label={`Delete ${lead.name}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add / Edit Lead Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-lg">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <h3 id="lead-modal-title" className="text-base font-semibold text-slate-900">
                {formState.id ? `Edit Lead ${formState.id}` : 'Add New Lead'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mt-4 px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50/70 text-xs text-red-900"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveForm} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="Rahul Sharma"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formState.mobile}
                    onChange={(e) => setFormState({ ...formState, mobile: e.target.value })}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email ID
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    placeholder="customer@example.com"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={formState.source}
                    onChange={(e) =>
                      setFormState({ ...formState, source: e.target.value as LeadSource })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  >
                    {LEAD_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    From City
                  </label>
                  <input
                    type="text"
                    value={formState.fromCity}
                    onChange={(e) => setFormState({ ...formState, fromCity: e.target.value })}
                    placeholder="Bangalore"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    To City
                  </label>
                  <input
                    type="text"
                    value={formState.toCity}
                    onChange={(e) => setFormState({ ...formState, toCity: e.target.value })}
                    placeholder="Mumbai"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Move Type
                  </label>
                  <select
                    value={formState.moveType}
                    onChange={(e) =>
                      setFormState({ ...formState, moveType: e.target.value as MoveType })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  >
                    {MOVE_TYPES.map((mt) => (
                      <option key={mt} value={mt}>
                        {mt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Requirement / Need
                </label>
                <input
                  type="text"
                  value={formState.requirement}
                  onChange={(e) => setFormState({ ...formState, requirement: e.target.value })}
                  placeholder="2 BHK Household / Local Household"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign Customer Support Rep
                  </label>
                  <select
                    value={formState.assignedRepId}
                    onChange={(e) =>
                      setFormState({ ...formState, assignedRepId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  >
                    <option value="">-- Unassigned --</option>
                    {reps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {!r.active ? ' (Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Lead Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({ ...formState, status: e.target.value as LeadStatus })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                  >
                    {LEAD_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Optional move date, floor details, or callback notes..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {formSubmitting
                    ? 'Saving...'
                    : formState.id
                    ? 'Update Lead'
                    : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Ticket Modal */}
      {ticketLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-lg">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <h3 id="ticket-modal-title" className="text-base font-semibold text-slate-900">
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
      <FollowUpCommentsModal
        lead={followUpLead}
        authToken={authToken}
        onUnauthorized={onUnauthorized}
        onLeadUpdated={handleLeadUpdatedFromFollowUp}
        onClose={() => setFollowUpLead(null)}
      />
    </div>
  );
};
