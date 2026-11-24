import React, { useState, useEffect, useCallback } from 'react';
import { ActiveCall, QueueMetrics, CallDetailRecord } from '../../types/ivr';
import {
  PhoneCall,
  Users,
  Activity,
  Clock,
  PhoneOff,
  Headphones,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  PhoneIncoming,
  Volume2,
  Download,
  Play,
} from 'lucide-react';

interface ExotelCallItem {
  sid: string;
  from: string;
  to: string;
  phoneNumberSid: string;
  status: string;
  direction: string;
  duration: string;
  dateCreated: string;
  recordingUrl: string;
  hasRecording?: boolean;
  audioProxyUrl?: string;
}

interface ExotelStatusInfo {
  exotel_ready: boolean;
  caller_id: string;
  flow_app_id: string;
  missing_env: string[];
}

interface LiveCallMonitorProps {
  activeCalls: ActiveCall[];
  queues: QueueMetrics[];
  cdrs: CallDetailRecord[];
  onTerminateCall: (channelId: string) => void;
}

export const LiveCallMonitor: React.FC<LiveCallMonitorProps> = ({
  activeCalls,
  queues,
  cdrs,
  onTerminateCall,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'queues' | 'cdrs' | 'exotel'>('exotel');
  const [exotelInfo, setExotelInfo] = useState<ExotelStatusInfo | null>(null);
  const [exotelCalls, setExotelCalls] = useState<ExotelCallItem[]>([]);
  const [exotelLoading, setExotelLoading] = useState<boolean>(false);
  const [exotelErr, setExotelErr] = useState<string | null>(null);
  const [onlyRecorded, setOnlyRecorded] = useState<boolean>(false);
  const [playingCallSid, setPlayingCallSid] = useState<string | null>(null);

  const loadExotelLogs = useCallback(async () => {
    setExotelLoading(true);
    setExotelErr(null);
    try {
      const statusRes = await fetch('/api/exotel/status');
      const statusData: ExotelStatusInfo | null = statusRes.ok ? await statusRes.json() : null;
      if (statusData) setExotelInfo(statusData);

      if (statusData?.exotel_ready) {
        const callsRes = await fetch('/api/exotel/calls');
        const callsData = await callsRes.json().catch(() => ({}));
        if (!callsRes.ok) {
          throw new Error(callsData?.detail || `HTTP ${callsRes.status}`);
        }
        setExotelCalls(Array.isArray(callsData.calls) ? callsData.calls : []);
      }
    } catch (err) {
      setExotelErr(err instanceof Error ? err.message : 'Unable to fetch Exotel logs');
    } finally {
      setExotelLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExotelLogs();
  }, [loadExotelLogs]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Telephony Infrastructure & Live Call Monitoring
            </h1>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
              ARI Real-Time Bus
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time supervisor console for Asterisk ARI channels, live hold queues, DTMF progression,
            abandonment analytics, and agent bridge orchestration.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'live'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Channels ({activeCalls.length})
          </button>
          <button
            onClick={() => setActiveTab('queues')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'queues'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Agent Queues ({queues.length})
          </button>
          <button
            onClick={() => setActiveTab('exotel')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'exotel'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Exotel Live (08047291107)
          </button>
          <button
            onClick={() => setActiveTab('cdrs')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'cdrs'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Call Logs (CDR)
          </button>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-mono uppercase text-slate-400">Active PSTN Channels</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-400">
            {activeCalls.length}
          </div>
          <span className="text-[11px] text-slate-500">Across 2 SIP Trunks</span>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-mono uppercase text-slate-400">Average IVR Wait Time</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            28s
          </div>
          <span className="text-[11px] text-emerald-500">-4.2s vs yesterday</span>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-mono uppercase text-slate-400">Queue Abandonment Rate</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            1.8%
          </div>
          <span className="text-[11px] text-slate-400">Under 3.0% SLA Target</span>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-mono uppercase text-slate-400">24h Inbound Volume</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-400">
            1,248
          </div>
          <span className="text-[11px] text-purple-400">98.4% Answered</span>
        </div>
      </div>

      {/* Tab: Live Channels */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/70 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Channel ID</th>
                    <th className="py-3 px-4 font-medium">Caller Details</th>
                    <th className="py-3 px-4 font-medium">DID Dialed</th>
                    <th className="py-3 px-4 font-medium">Current State</th>
                    <th className="py-3 px-4 font-medium">DTMF Nav</th>
                    <th className="py-3 px-4 font-medium text-right">Duration</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {activeCalls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 font-mono">
                        No active channels in Stasis right now. Use the softphone to simulate a call!
                      </td>
                    </tr>
                  ) : (
                    activeCalls.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-cyan-300">
                          {call.channelId}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{call.callerId}</span>
                          <span className="text-slate-400 text-[11px]">{call.callerName}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                          {call.did}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase ${
                              call.state === 'in_ivr'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                                : call.state === 'on_hold'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : call.state === 'bridged_agent'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {call.state.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {call.dtmfHistory.length > 0 ? (
                            <div className="flex gap-1">
                              {call.dtmfHistory.map((d, i) => (
                                <span
                                  key={i}
                                  className="bg-slate-950 text-cyan-300 px-1.5 py-0.2 rounded border border-slate-800 font-bold"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                          {Math.floor(call.durationSec / 60)}:
                          {(call.durationSec % 60).toString().padStart(2, '0')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onTerminateCall(call.channelId)}
                              className="text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 px-2 py-1 rounded text-[11px] font-mono transition-colors"
                              title="Force Hangup Channel"
                            >
                              Hangup
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Agent Queues */}
      {activeTab === 'queues' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {queues.map((q) => (
            <div
              key={q.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">{q.name}</h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Strategy: {q.strategy}
                  </span>
                </div>
                <Users className="w-5 h-5 text-orange-400" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Agents Available</span>
                  <span className="text-emerald-400 font-bold text-base">{q.agentsAvailable}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Agents On Call</span>
                  <span className="text-cyan-400 font-bold text-base">{q.agentsBusy}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Waiting in Queue</span>
                  <span className="text-amber-400 font-bold text-base">{q.callersWaiting}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Avg Hold Time</span>
                  <span className="text-white font-bold text-base">{q.avgWaitSec}s</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Abandonment: {q.abandonedRatePct}%</span>
                <span className="text-emerald-400">SLA: Normal</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Call Logs (CDR) */}
      {activeTab === 'cdrs' && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/70 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-medium">Time (UTC)</th>
                  <th className="py-3 px-4 font-medium">Caller ID</th>
                  <th className="py-3 px-4 font-medium">DID Dialed</th>
                  <th className="py-3 px-4 font-medium">Call Flow Traversed</th>
                  <th className="py-3 px-4 font-medium">Disposition</th>
                  <th className="py-3 px-4 font-medium">DTMF Path</th>
                  <th className="py-3 px-4 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {cdrs.map((cdr) => (
                  <tr key={cdr.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">{cdr.startTime}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-white">
                      {cdr.callerId}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{cdr.did}</td>
                    <td className="py-3 px-4">{cdr.flowName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                          cdr.disposition === 'ANSWERED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : cdr.disposition === 'ABANDONED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-purple-950 text-purple-400 border border-purple-800'
                        }`}
                      >
                        {cdr.disposition}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {cdr.dtmfPath.join(' -> ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                      {cdr.durationSec}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Exotel Live Logs (08047291107) */}
      {activeTab === 'exotel' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-amber-800/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <PhoneIncoming className="w-4 h-4" />
                <span>Packyatra Exotel Live Feed · ExoPhone {exotelInfo?.caller_id || '08047291107'} (Flow #{exotelInfo?.flow_app_id || '1386346'})</span>
              </div>
              <p className="text-xs text-slate-400">
                {exotelInfo?.exotel_ready
                  ? 'Connected to Exotel REST API — showing live inbound/outbound calls & call recordings.'
                  : 'Inbound IVR on 08047291107 is live. Add EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY & EXOTEL_API_TOKEN to AI Studio Secrets to sync live call history & recordings here.'}
              </p>
            </div>
            <button
              type="button"
              onClick={loadExotelLogs}
              disabled={exotelLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-mono text-white flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${exotelLoading ? 'animate-spin' : ''}`} />
              <span>{exotelLoading ? 'Syncing...' : 'Refresh Exotel Logs'}</span>
            </button>
          </div>

          {exotelErr && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-200 font-mono">
              Exotel Sync Error: {exotelErr}
            </div>
          )}

          {!exotelInfo?.exotel_ready ? (
            <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-3 text-xs text-slate-300">
              <div className="font-bold text-white text-sm">3 Next Steps to Turn This Into a Full Production Console:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>
                  <strong>Sync Live Exotel Call Logs &amp; Outbound Calls:</strong> Add <code className="text-cyan-300">EXOTEL_ACCOUNT_SID</code>, <code className="text-cyan-300">EXOTEL_API_KEY</code>, and <code className="text-cyan-300">EXOTEL_API_TOKEN</code> (from Exotel <em>Settings → API Settings</em>) into <strong>AI Studio → Settings → Secrets</strong>.
                </li>
                <li>
                  <strong>Enable Recording &amp; Missed-Call Fallback in Flow #1386346:</strong> Inside App Bazaar, turn ON <strong>Record call</strong> in each Connect applet and attach a fallback Connect/Email/SMS if a Co-worker doesn&apos;t answer in 30s.
                </li>
                <li>
                  <strong>Submit Business KYC in Exotel:</strong> Before the trial expires, upload Company PAN/GST/Address proof in Exotel Settings so <code className="text-amber-300">08047291107</code> stays permanent and outbound calls aren&apos;t limited to the 10-number whitelist.
                </li>
              </ol>
            </div>
          ) : (() => {
            const recordedCalls = exotelCalls.filter((c) => Boolean(c.recordingUrl));
            const displayedCalls = onlyRecorded ? recordedCalls : exotelCalls;
            const activeCall = exotelCalls.find((c) => c.sid === playingCallSid) || null;

            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setOnlyRecorded(false)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                        !onlyRecorded
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All Calls ({exotelCalls.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlyRecorded(true)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                        onlyRecorded
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/70 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Recorded Audio ({recordedCalls.length})</span>
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Audio streams securely through server proxy (no Exotel login popup)
                  </span>
                </div>

                {recordedCalls.length === 0 && exotelCalls.length > 0 && (
                  <div className="p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-100 space-y-1">
                    <div className="font-bold text-amber-300">
                      0 of your {exotelCalls.length} existing calls have recordings stored on Exotel yet
                    </div>
                    <p className="text-[11px] text-amber-100/90 leading-relaxed">
                      To record all future inbound calls automatically: open <strong>Exotel → App Bazaar → packyatra1 Landing Flow (#1386346)</strong> → click each <strong>Connect</strong> applet (Press 1, 2, 3) → tick <strong>&quot;Record&quot;</strong> → click <strong>Save</strong>. Outbound bridges &amp; IVR calls triggered from this app already request <code>Record=true</code> automatically.
                    </p>
                  </div>
                )}

                {activeCall && activeCall.recordingUrl && (
                  <div className="p-3.5 bg-slate-900 border border-emerald-700/70 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-0.5 text-xs">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4" />
                        <span>
                          Playing Recording: {activeCall.from} ➔ {activeCall.to}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {activeCall.dateCreated} · {activeCall.duration}s · SID {activeCall.sid.slice(0, 12)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <audio
                        key={activeCall.sid}
                        controls
                        autoPlay
                        src={activeCall.audioProxyUrl || `/api/exotel/calls/${encodeURIComponent(activeCall.sid)}/recording`}
                        className="h-9 max-w-xs"
                      />
                      <a
                        href={`${activeCall.audioProxyUrl || `/api/exotel/calls/${encodeURIComponent(activeCall.sid)}/recording`}?download=1`}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-[11px] font-mono flex items-center gap-1 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>MP3</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/70 shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4 font-medium">Created</th>
                          <th className="py-3 px-4 font-medium">Direction</th>
                          <th className="py-3 px-4 font-medium">From</th>
                          <th className="py-3 px-4 font-medium">To (Co-worker)</th>
                          <th className="py-3 px-4 font-medium">Status</th>
                          <th className="py-3 px-4 font-medium">Duration</th>
                          <th className="py-3 px-4 font-medium text-right">Recorded Audio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {displayedCalls.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-500 font-mono">
                              {onlyRecorded
                                ? 'No recorded calls yet. Enable "Record" in Exotel Connect applets, make a call, and click Refresh!'
                                : 'No Exotel calls returned yet. Place a test call to 08047291107 and click Refresh!'}
                            </td>
                          </tr>
                        ) : (
                          displayedCalls.map((c) => {
                            const streamUrl =
                              c.audioProxyUrl ||
                              `/api/exotel/calls/${encodeURIComponent(c.sid)}/recording`;
                            const isPlaying = playingCallSid === c.sid;
                            return (
                              <tr key={c.sid} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-3 px-4 font-mono text-slate-400">{c.dateCreated}</td>
                                <td className="py-3 px-4 font-mono text-cyan-300">{c.direction}</td>
                                <td className="py-3 px-4 font-mono font-semibold text-white">{c.from}</td>
                                <td className="py-3 px-4 font-mono text-emerald-300">{c.to}</td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700">
                                    {c.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono tabular-nums">{c.duration}s</td>
                                <td className="py-3 px-4 text-right">
                                  {c.recordingUrl ? (
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setPlayingCallSid(isPlaying ? null : c.sid)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                                          isPlaying
                                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                                            : 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-700/70 text-emerald-300'
                                        }`}
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                        <span>{isPlaying ? 'Playing' : 'Listen'}</span>
                                      </button>
                                      <a
                                        href={`${streamUrl}?download=1`}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-[11px] font-mono"
                                        title="Download MP3"
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-mono text-slate-600">Not recorded</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
