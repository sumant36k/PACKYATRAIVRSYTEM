import React, { useCallback, useEffect, useState } from 'react';
import { ListOrdered, Menu, Phone, RefreshCw, X } from 'lucide-react';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { ExotelCallLogsScreen } from './components/ExotelCallLogsScreen';
import { ExotelTelephoneScreen } from './components/ExotelTelephoneScreen';
import {
  DEFAULT_IVR_ROUTES,
  ExotelCallRecord,
  ExotelStatus,
  IvrRouteEntry,
} from './types/exotel';

type ActiveScreen = 'telephone' | 'logs';

const ROUTES_STORAGE_KEY = 'packyatra_exotel_ivr_routes_v1';

function loadSavedRoutes(): IvrRouteEntry[] {
  try {
    const raw = localStorage.getItem(ROUTES_STORAGE_KEY);
    if (!raw) return DEFAULT_IVR_ROUTES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Ignore storage parse error
  }
  return DEFAULT_IVR_ROUTES;
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('telephone');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [status, setStatus] = useState<ExotelStatus | null>(null);
  const [calls, setCalls] = useState<ExotelCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingCall, setPlayingCall] = useState<ExotelCallRecord | null>(null);
  const [routes, setRoutes] = useState<IvrRouteEntry[]>(loadSavedRoutes);

  const fetchExotelData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch('/api/exotel/status');
      const statusData = (await statusRes.json().catch(() => null)) as ExotelStatus | null;
      setStatus(statusData);

      if (!statusData?.exotel_ready) {
        setCalls([]);
        setError(
          statusData?.invalid_account_sid
            ? 'EXOTEL_ACCOUNT_SID contains spaces. Set it to your Exotel Account SID (e.g. packyatra1).'
            : 'Add EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN to your environment to load live Exotel calls.'
        );
        return;
      }

      const callsRes = await fetch('/api/exotel/calls');
      const callsData = await callsRes.json().catch(() => ({}));
      if (!callsRes.ok) {
        setError(callsData?.detail || `Exotel API error (HTTP ${callsRes.status})`);
      } else {
        setCalls(Array.isArray(callsData?.calls) ? callsData.calls : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Exotel server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExotelData();
  }, [fetchExotelData]);

  const handleUpdateRoutes = (next: IvrRouteEntry[]) => {
    setRoutes(next);
    try {
      localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota error
    }
  };

  const navItems: Array<{ id: ActiveScreen; label: string; icon: React.ReactNode }> = [
    {
      id: 'telephone',
      label: 'Telephone & IVR',
      icon: <Phone className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'logs',
      label: 'Call Logs & Audio',
      icon: <ListOrdered className="w-4 h-4 shrink-0" />,
    },
  ];

  const pageTitle = activeScreen === 'telephone' ? 'Telephone & IVR' : 'Call Logs & Audio';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-slate-200 shrink-0">
        <div className="h-15 px-5 border-b border-slate-200 flex items-center">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Packyatra Voice
          </span>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-medium text-slate-800">Exotel Line</div>
          <div className="font-mono tabular-nums text-slate-700">
            {status?.caller_id || '08047291107'}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span>{status?.exotel_ready ? 'Connected' : 'Not configured'}</span>
            {status?.account_sid_masked && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{status.account_sid_masked}</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full flex flex-col border-r border-slate-200 z-50">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Packyatra Voice
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-1">
              {navItems.map((item) => {
                const active = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <div className="font-medium text-slate-800">Exotel Line</div>
              <div className="font-mono tabular-nums text-slate-700">
                {status?.caller_id || '08047291107'}
              </div>
              <div>{status?.exotel_ready ? 'Connected' : 'Not configured'}</div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, Single Action on Right */}
        <header className="h-15 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                Packyatra Voice
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{pageTitle}</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchExotelData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Exotel
          </button>
        </header>

        {/* Viewport Container */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
          <AudioPlayerBar call={playingCall} onClose={() => setPlayingCall(null)} />

          {activeScreen === 'telephone' ? (
            <ExotelTelephoneScreen
              status={status}
              calls={calls}
              routes={routes}
              onUpdateRoutes={handleUpdateRoutes}
              onCallPlaced={fetchExotelData}
              onPlayRecording={(call) => setPlayingCall(call)}
              onOpenLogs={() => setActiveScreen('logs')}
            />
          ) : (
            <ExotelCallLogsScreen
              status={status}
              calls={calls}
              loading={loading}
              error={error}
              playingCallSid={playingCall?.sid || null}
              onRefresh={fetchExotelData}
              onPlayRecording={(call) => setPlayingCall(call)}
              onOpenDialer={() => setActiveScreen('telephone')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
