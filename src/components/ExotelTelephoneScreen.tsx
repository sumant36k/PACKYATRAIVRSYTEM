import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Delete,
  Edit3,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Play,
  Save,
  X,
} from 'lucide-react';
import {
  ExotelCallRecord,
  ExotelStatus,
  IvrRouteEntry,
  formatCallTime,
  formatDirection,
  formatDuration,
} from '../types/exotel';

interface ExotelTelephoneScreenProps {
  status: ExotelStatus | null;
  calls: ExotelCallRecord[];
  routes: IvrRouteEntry[];
  authToken: string | null;
  dialTargetOverride?: { number: string; nonce: number } | null;
  onUnauthorized: () => void;
  onUpdateRoutes: (routes: IvrRouteEntry[]) => void;
  onCallPlaced: () => void;
  onPlayRecording: (call: ExotelCallRecord) => void;
  onOpenLogs: () => void;
}

const KEYPAD_KEYS: Array<{ digit: string; letters: string }> = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export const ExotelTelephoneScreen: React.FC<ExotelTelephoneScreenProps> = ({
  status,
  calls,
  routes,
  authToken,
  dialTargetOverride,
  onUnauthorized,
  onUpdateRoutes,
  onCallPlaced,
  onPlayRecording,
  onOpenLogs,
}) => {
  const [dialMode, setDialMode] = useState<'bridge' | 'ivr'>('bridge');
  const [agentPhone, setAgentPhone] = useState(routes[0]?.phone || '+919916109192');
  const [targetNumber, setTargetNumber] = useState('');
  const [flowAppId, setFlowAppId] = useState(status?.flow_app_id || '1386346');

  useEffect(() => {
    if (status?.flow_app_id) {
      setFlowAppId(status.flow_app_id);
    }
  }, [status?.flow_app_id]);

  useEffect(() => {
    if (dialTargetOverride?.number) {
      setDialMode('bridge');
      setTargetNumber(dialTargetOverride.number);
      setFeedback(null);
    }
  }, [dialTargetOverride]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    callSid?: string;
  } | null>(null);

  const [copiedExoPhone, setCopiedExoPhone] = useState(false);
  const [editingRoutes, setEditingRoutes] = useState(false);
  const [draftRoutes, setDraftRoutes] = useState<IvrRouteEntry[]>(routes);

  const exoPhone = status?.caller_id || '08047291107';
  const activeFlowId = status?.flow_app_id || flowAppId || '1386346';

  const handleDigitPress = (digit: string) => {
    setTargetNumber((prev) => `${prev}${digit}`);
  };

  const handleBackspace = () => {
    setTargetNumber((prev) => prev.slice(0, -1));
  };

  const handleCopyExoPhone = async () => {
    try {
      await navigator.clipboard.writeText(exoPhone);
      setCopiedExoPhone(true);
      setTimeout(() => setCopiedExoPhone(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const triggerCall = async (overrideTarget?: string, overrideMode?: 'bridge' | 'ivr') => {
    const mode = overrideMode || dialMode;
    const destination = (overrideTarget ?? targetNumber).trim();

    if (!destination) {
      setFeedback({ type: 'error', text: 'Enter a phone number to dial.' });
      return;
    }

    if (mode === 'bridge' && !agentPhone.trim()) {
      setFeedback({ type: 'error', text: 'Enter an Agent Mobile number to answer first.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const endpoint = mode === 'bridge' ? '/api/exotel/calls/bridge' : '/api/exotel/calls/ivr';
      const payload =
        mode === 'bridge'
          ? {
              agentPhone: agentPhone.trim(),
              destination,
              callerId: exoPhone,
            }
          : {
              to: destination,
              callerId: exoPhone,
              flowAppId: flowAppId.trim() || activeFlowId,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFeedback({
          type: 'error',
          text: data?.detail || `Call request failed (HTTP ${res.status})`,
        });
      } else {
        setFeedback({
          type: 'success',
          text: data?.message || 'Call initiated.',
          callSid: data?.call_sid,
        });
        setTimeout(() => {
          onCallPlaced();
        }, 1800);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to reach voice proxy server.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditRoutes = () => {
    setDraftRoutes(routes.map((r) => ({ ...r })));
    setEditingRoutes(true);
  };

  const handleSaveRoutes = () => {
    onUpdateRoutes(draftRoutes);
    setEditingRoutes(false);
  };

  const recentCalls = calls.slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Telephone Dialer */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Telephone Dialer</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Caller ID <span className="font-mono tabular-nums text-slate-700">{exoPhone}</span>
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => {
                setDialMode('bridge');
                setFeedback(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                dialMode === 'bridge'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2-Way Call
            </button>
            <button
              type="button"
              onClick={() => {
                setDialMode('ivr');
                setFeedback(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                dialMode === 'ivr'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              IVR Flow
            </button>
          </div>
        </div>

        {/* Agent Selector (Direct 2-Way Call mode) */}
        {dialMode === 'bridge' ? (
          <div className="mb-4">
            <label
              htmlFor="agent-phone-input"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Agent Mobile (Answers First)
            </label>
            <input
              id="agent-phone-input"
              type="tel"
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              placeholder="+919916109192"
              className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {routes.map((route) => {
                const isSelected = agentPhone.replace(/\D/g, '').endsWith(route.phone.replace(/\D/g, '').slice(-10));
                return (
                  <button
                    key={route.key}
                    type="button"
                    onClick={() => setAgentPhone(route.phone)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {route.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label
              htmlFor="flow-app-id-input"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              IVR Flow ID
            </label>
            <input
              id="flow-app-id-input"
              type="text"
              value={flowAppId}
              onChange={(e) => setFlowAppId(e.target.value)}
              placeholder="1386346"
              className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            />
          </div>
        )}

        {/* Target Number Display */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="target-phone-input"
              className="text-xs font-medium text-slate-700"
            >
              {dialMode === 'bridge' ? 'Customer / Target Number' : 'Phone Number to Receive IVR'}
            </label>
            {targetNumber && (
              <button
                type="button"
                onClick={() => setTargetNumber('')}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="relative flex items-center">
            <input
              id="target-phone-input"
              type="tel"
              value={targetNumber}
              onChange={(e) => setTargetNumber(e.target.value)}
              placeholder="Enter phone number"
              className="w-full pl-4 pr-11 py-3 text-xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 placeholder:text-sm placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
            />
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Delete last digit"
              className="absolute right-2 p-2 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tactile DTMF Keypad */}
        <div className="grid grid-cols-3 gap-2.5 mb-5" role="group" aria-label="Telephone keypad">
          {KEYPAD_KEYS.map((item) => (
            <button
              key={item.digit}
              type="button"
              onClick={() => handleDigitPress(item.digit)}
              className="h-13 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 flex flex-col items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span className="text-lg font-semibold font-mono tabular-nums text-slate-900 leading-none">
                {item.digit}
              </span>
              {item.letters ? (
                <span className="text-[10px] font-medium text-slate-400 tracking-wider mt-1 leading-none">
                  {item.letters}
                </span>
              ) : (
                <span className="h-3" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        {/* Primary Call Action */}
        <button
          type="button"
          disabled={submitting || !status?.exotel_ready}
          onClick={() => triggerCall()}
          className="w-full h-11 px-5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          {dialMode === 'bridge' ? (
            <PhoneCall className="w-4 h-4" />
          ) : (
            <PhoneForwarded className="w-4 h-4" />
          )}
          {submitting
            ? 'Connecting Call...'
            : dialMode === 'bridge'
            ? 'Place 2-Way Call'
            : 'Send IVR Menu Call'}
        </button>

        {!status?.exotel_ready && (
          <p className="text-xs text-amber-700 mt-3">
            Voice telephony credentials are not configured yet in your environment.
          </p>
        )}

        {feedback && (
          <div
            role="status"
            className={`mt-4 px-3.5 py-3 rounded-lg border text-xs leading-relaxed ${
              feedback.type === 'success'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-red-50/70 border-red-200 text-red-900'
            }`}
          >
            <div className="font-medium">{feedback.text}</div>
            {feedback.callSid && (
              <div className="mt-1 font-mono tabular-nums text-emerald-700">
                Call SID: {feedback.callSid}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Right Column: Active IVR Line, 3-Option Directory, and Recent Calls */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {/* Inbound Virtual Number & IVR Flow Overview */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xs font-medium text-slate-500">Active Virtual Number</div>
              <div className="text-2xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 mt-1">
                {exoPhone}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{status?.flow_name || 'packyatra1 Landing Flow'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Flow #{activeFlowId}</span>
                <span aria-hidden="true">·</span>
                <span>Auto Call Recording On</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyExoPhone}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copiedExoPhone ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Number
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={submitting || !status?.exotel_ready}
                onClick={() => triggerCall(agentPhone, 'ivr')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                Test IVR on Owner
              </button>
            </div>
          </div>

          {/* 3-Option IVR Keypress Routing Table */}
          <div className="pt-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">IVR Keypress Directory</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Callers dialing {exoPhone} press 1, 2, or 3 to reach your team.
                </p>
              </div>
              {!editingRoutes ? (
                <button
                  type="button"
                  onClick={handleStartEditRoutes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Labels
                </button>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveRoutes}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRoutes(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {(editingRoutes ? draftRoutes : routes).map((route, idx) => (
                <div
                  key={route.key}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-mono tabular-nums text-sm font-semibold flex items-center justify-center shrink-0">
                      {route.key}
                    </span>

                    {editingRoutes ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                        <input
                          type="text"
                          value={route.label}
                          onChange={(e) => {
                            const next = [...draftRoutes];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setDraftRoutes(next);
                          }}
                          className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
                          aria-label={`Press ${route.key} label`}
                        />
                        <input
                          type="tel"
                          value={route.phone}
                          onChange={(e) => {
                            const next = [...draftRoutes];
                            next[idx] = { ...next[idx], phone: e.target.value };
                            setDraftRoutes(next);
                          }}
                          className="px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-md focus:outline-none focus:border-blue-700"
                          aria-label={`Press ${route.key} phone number`}
                        />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          Press {route.key} — {route.label}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          {route.phone}
                        </div>
                      </div>
                    )}
                  </div>

                  {!editingRoutes && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDialMode('bridge');
                          setTargetNumber(route.phone);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Load in Dialer
                      </button>
                      <button
                        type="button"
                        disabled={submitting || !status?.exotel_ready}
                        onClick={() => {
                          setTargetNumber(route.phone);
                          triggerCall(route.phone, 'bridge');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Bridge Now
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {status?.trial_number && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Trial Sandbox Access:</span>
                <span className="font-mono tabular-nums text-slate-700">{status.trial_number}</span>
                <span aria-hidden="true">·</span>
                <span>PIN</span>
                <span className="font-mono tabular-nums text-slate-700">{status.trial_pin}</span>
              </div>
            )}
          </div>
        </section>

        {/* Latest 5 Live Calls Preview */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Calls</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest activity on {exoPhone}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenLogs}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors whitespace-nowrap shrink-0"
            >
              View All Logs
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentCalls.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border-t border-slate-100">
              No calls synced yet. Place a call using the dialer or dial {exoPhone}.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {recentCalls.map((call) => (
                <div
                  key={call.sid}
                  className="py-2.5 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono tabular-nums text-slate-900 text-xs sm:text-sm truncate">
                      {call.from || 'Unknown'} &rarr; {call.to || call.phoneNumberSid}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{formatDirection(call.direction)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{call.status || 'unknown'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatCallTime(call.dateCreated)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono tabular-nums text-slate-600">
                      {formatDuration(call.duration)}
                    </span>
                    {call.hasRecording ? (
                      <button
                        type="button"
                        onClick={() => onPlayRecording(call)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        Listen
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 w-16 text-right">No audio</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
