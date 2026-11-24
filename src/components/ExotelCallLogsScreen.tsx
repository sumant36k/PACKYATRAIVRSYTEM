import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileDown,
  Phone,
  Play,
  RefreshCw,
  Search,
  Volume2,
} from 'lucide-react';
import {
  ExotelCallRecord,
  ExotelStatus,
  formatCallTime,
  formatDirection,
  formatDuration,
} from '../types/exotel';

interface ExotelCallLogsScreenProps {
  status: ExotelStatus | null;
  calls: ExotelCallRecord[];
  loading: boolean;
  error: string | null;
  playingCallSid: string | null;
  authToken: string | null;
  onUnauthorized: () => void;
  onRefresh: () => void;
  onPlayRecording: (call: ExotelCallRecord) => void;
  onOpenDialer: () => void;
}

type LogFilter = 'all' | 'recorded' | 'inbound' | 'outbound';

function statusTextClass(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (s === 'completed') return 'text-emerald-700';
  if (s === 'in-progress' || s === 'ringing' || s === 'queued') return 'text-blue-700';
  if (s === 'busy' || s === 'no-answer' || s === 'canceled') return 'text-amber-700';
  if (s === 'failed') return 'text-red-700';
  return 'text-slate-600';
}

export const ExotelCallLogsScreen: React.FC<ExotelCallLogsScreenProps> = ({
  status,
  calls,
  loading,
  error,
  playingCallSid,
  authToken,
  onUnauthorized,
  onRefresh,
  onPlayRecording,
  onOpenDialer,
}) => {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [search, setSearch] = useState('');

  const metrics = useMemo(() => {
    const total = calls.length;
    const completed = calls.filter((c) => c.status.toLowerCase() === 'completed').length;
    const recorded = calls.filter((c) => c.hasRecording).length;
    const totalSeconds = calls.reduce(
      (sum, c) => sum + (Number.parseInt(c.duration || '0', 10) || 0),
      0
    );
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return {
      total,
      completed,
      recorded,
      totalTalkFormatted: `${mins}m ${secs}s`,
    };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    return calls.filter((call) => {
      if (filter === 'recorded' && !call.hasRecording) return false;
      if (filter === 'inbound' && formatDirection(call.direction) !== 'Inbound') return false;
      if (filter === 'outbound' && formatDirection(call.direction) !== 'Outbound') return false;
      if (!q) return true;
      return (
        call.from.toLowerCase().includes(q) ||
        call.to.toLowerCase().includes(q) ||
        call.sid.toLowerCase().includes(q) ||
        call.status.toLowerCase().includes(q)
      );
    });
  }, [calls, filter, search]);

  const handleExportCsv = () => {
    const headers = ['DateTime', 'Direction', 'From', 'To', 'Status', 'DurationSec', 'Recorded', 'CallSID'];
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = filteredCalls.map((c) =>
      [
        c.dateCreated,
        formatDirection(c.direction),
        c.from,
        c.to || c.phoneNumberSid,
        c.status,
        c.duration,
        c.hasRecording ? 'Yes' : 'No',
        c.sid,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadRecording = async (call: ExotelCallRecord) => {
    if (!authToken || !call.audioProxyUrl) return;
    try {
      const res = await fetch(`${call.audioProxyUrl}?download=1`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call_${call.sid}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore download failure
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 4-Column Live Metrics Strip */}
      <section
        aria-label="Call log summary"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total Synced Calls</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1.5">
            {metrics.total}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Completed Calls</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 mt-1.5">
            {metrics.completed}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Recorded Audio Files</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-blue-700 mt-1.5">
            {metrics.recorded}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Total Talk Time</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1.5">
            {metrics.totalTalkFormatted}
          </div>
        </div>
      </section>

      {/* Recording Reminder when zero recordings exist */}
      {!loading && !error && calls.length > 0 && metrics.recorded === 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-5 py-3.5 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">No recordings returned yet.</span>{' '}
            Make sure call recording is enabled inside IVR flow #{status?.flow_app_id || '1386346'}.
          </div>
        </div>
      )}

      {/* Main Call Logs Table Container */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `All (${metrics.total})` },
                  { id: 'recorded', label: `Recorded (${metrics.recorded})` },
                  { id: 'inbound', label: 'Inbound' },
                  { id: 'outbound', label: 'Outbound' },
                ] as Array<{ id: LogFilter; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search number, status, SID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={filteredCalls.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-50 text-red-600 mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Unable to load call logs</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {!error && loading && calls.length === 0 && (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse">
                <div className="h-3.5 w-28 bg-slate-200 rounded" />
                <div className="h-3.5 w-32 bg-slate-200 rounded" />
                <div className="h-3.5 w-32 bg-slate-200 rounded" />
                <div className="h-3.5 w-16 bg-slate-200 rounded" />
                <div className="h-7 w-24 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!error && !loading && filteredCalls.length === 0 && (
          <div className="py-14 px-6 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 mb-3">
              <Phone className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              {calls.length === 0 ? 'No calls yet' : 'No matching calls found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {calls.length === 0
                ? `Calls placed through ${status?.caller_id || '08047291107'} will appear here with playable MP3 recordings.`
                : 'Try clearing your search query or switching to the All Calls filter.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {calls.length === 0 ? (
                <button
                  type="button"
                  onClick={onOpenDialer}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
                >
                  Open Telephone
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearch('');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Data Table */}
        {!error && filteredCalls.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">Time</th>
                  <th className="py-3 px-3 whitespace-nowrap">Direction</th>
                  <th className="py-3 px-3 whitespace-nowrap">From</th>
                  <th className="py-3 px-3 whitespace-nowrap">To</th>
                  <th className="py-3 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Duration</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCalls.map((call) => {
                  const dir = formatDirection(call.direction);
                  const isPlaying = playingCallSid === call.sid;
                  return (
                    <tr
                      key={call.sid}
                      className={`transition-colors ${
                        isPlaying ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 pl-5 pr-3 text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatCallTime(call.dateCreated)}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {dir === 'Inbound' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          {dir}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {call.from || '—'}
                      </td>
                      <td className="py-3 px-3 text-xs font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {call.to || call.phoneNumberSid || '—'}
                      </td>
                      <td className={`py-3 px-3 text-xs font-medium capitalize whitespace-nowrap ${statusTextClass(call.status)}`}>
                        {call.status || 'unknown'}
                      </td>
                      <td className="py-3 px-3 text-xs font-mono tabular-nums text-slate-700 text-right whitespace-nowrap">
                        {formatDuration(call.duration)}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        {call.hasRecording ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onPlayRecording(call)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                isPlaying
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              {isPlaying ? (
                                <Volume2 className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                              {isPlaying ? 'Playing' : 'Listen'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadRecording(call)}
                              aria-label={`Download recording for ${call.from}`}
                              title="Download MP3"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No audio</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
