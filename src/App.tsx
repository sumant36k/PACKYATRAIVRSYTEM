import React, { useCallback, useEffect, useState } from 'react';
import { ListOrdered, LogOut, Menu, Phone, RefreshCw, UserCheck, Users, X } from 'lucide-react';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { ExotelCallLogsScreen } from './components/ExotelCallLogsScreen';
import { ExotelTelephoneScreen } from './components/ExotelTelephoneScreen';
import { LeadManagementScreen } from './components/LeadManagementScreen';
import { LoginScreen } from './components/LoginScreen';
import { MyAssignedLeadsScreen } from './components/MyAssignedLeadsScreen';
import {
  AppRole,
  AuthUser,
  DEFAULT_IVR_ROUTES,
  ExotelCallRecord,
  ExotelStatus,
  IvrRouteEntry,
  resolveAppRole,
} from './types/exotel';

type ActiveScreen = 'telephone' | 'logs' | 'leads' | 'my-leads';

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
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('my-leads');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [status, setStatus] = useState<ExotelStatus | null>(null);
  const [calls, setCalls] = useState<ExotelCallRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingCall, setPlayingCall] = useState<ExotelCallRecord | null>(null);
  const [routes, setRoutes] = useState<IvrRouteEntry[]>(loadSavedRoutes);
  const [dialTargetOverride, setDialTargetOverride] = useState<{
    number: string;
    nonce: number;
  } | null>(null);

  const appRole: AppRole =
    authUser?.appRole ||
    resolveAppRole(authUser?.role, authUser?.firstName, authUser?.email);

  useEffect(() => {
    if (!authUser) return;
    if (appRole === 'admin' && activeScreen === 'my-leads') {
      setActiveScreen('leads');
    } else if (appRole === 'support' && activeScreen === 'leads') {
      setActiveScreen('my-leads');
    }
  }, [authUser, appRole, activeScreen]);

  const handleUnauthorized = useCallback(() => {
    setAuthToken(null);
    setAuthUser(null);
    setStatus(null);
    setCalls([]);
    setPlayingCall(null);
    setMobileMenuOpen(false);
    setSessionNotice('Your session expired. Please sign in again.');
  }, []);

  const handleLogout = useCallback(async () => {
    const currentToken = authToken;
    setAuthToken(null);
    setAuthUser(null);
    setStatus(null);
    setCalls([]);
    setPlayingCall(null);
    setError(null);
    setSessionNotice(null);
    setMobileMenuOpen(false);

    if (currentToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
  }, [authToken]);

  const fetchExotelData = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const statusRes = await fetch('/api/exotel/status', { headers });
      if (statusRes.status === 401) {
        handleUnauthorized();
        return;
      }
      const statusData = (await statusRes.json().catch(() => null)) as ExotelStatus | null;
      setStatus(statusData);

      if (!statusData?.exotel_ready) {
        setCalls([]);
        setError(
          statusData?.invalid_account_sid
            ? 'Voice Account SID contains spaces. Check your telephony configuration.'
            : 'Telephony credentials are not configured in your environment to load live calls.'
        );
        return;
      }

      const callsRes = await fetch('/api/exotel/calls', { headers });
      if (callsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      const callsData = await callsRes.json().catch(() => ({}));
      if (!callsRes.ok) {
        setError(callsData?.detail || `Voice API error (HTTP ${callsRes.status})`);
      } else {
        setCalls(Array.isArray(callsData?.calls) ? callsData.calls : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach voice server.');
    } finally {
      setLoading(false);
    }
  }, [authToken, handleUnauthorized]);

  useEffect(() => {
    if (authToken) {
      fetchExotelData();
    }
  }, [authToken, fetchExotelData]);

  const handleLoginSuccess = (token: string, user: AuthUser) => {
    const resolvedRole =
      user.appRole || resolveAppRole(user.role, user.firstName, user.email);
    setSessionNotice(null);
    setAuthToken(token);
    setAuthUser({ ...user, appRole: resolvedRole });
    setActiveScreen(resolvedRole === 'admin' ? 'leads' : 'my-leads');
  };

  const handleDialLeadNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    const formatted =
      cleaned.startsWith('+')
        ? cleaned
        : cleaned.length === 10
        ? `+91${cleaned}`
        : cleaned;
    setDialTargetOverride({ number: formatted, nonce: Date.now() });
    setActiveScreen('telephone');
  };

  if (!authToken || !authUser) {
    return (
      <LoginScreen
        sessionNotice={sessionNotice}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const handleUpdateRoutes = (next: IvrRouteEntry[]) => {
    setRoutes(next);
    try {
      localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota error
    }
  };

  const allNavItems: Array<{
    id: ActiveScreen;
    label: string;
    icon: React.ReactNode;
    roles: AppRole[];
  }> = [
    {
      id: 'leads',
      label: 'Lead Management',
      icon: <Users className="w-4 h-4 shrink-0" />,
      roles: ['admin'],
    },
    {
      id: 'my-leads',
      label: 'My Assigned Leads',
      icon: <UserCheck className="w-4 h-4 shrink-0" />,
      roles: ['support'],
    },
    {
      id: 'telephone',
      label: 'Telephone & IVR',
      icon: <Phone className="w-4 h-4 shrink-0" />,
      roles: ['admin', 'support'],
    },
    {
      id: 'logs',
      label: 'Call Logs & Audio',
      icon: <ListOrdered className="w-4 h-4 shrink-0" />,
      roles: ['admin', 'support'],
    },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(appRole));
  const safeScreen: ActiveScreen = navItems.some((item) => item.id === activeScreen)
    ? activeScreen
    : appRole === 'admin'
    ? 'leads'
    : 'my-leads';

  const roleLabel =
    authUser.role || (appRole === 'admin' ? 'Admin' : 'Customer Support');

  const userInitial = (authUser.firstName || 'U').trim().charAt(0).toUpperCase() || 'U';

  const pageTitle =
    safeScreen === 'leads'
      ? 'Lead Management'
      : safeScreen === 'my-leads'
      ? 'My Assigned Leads'
      : safeScreen === 'telephone'
      ? 'Telephone & IVR'
      : 'Call Logs & Audio';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Corporate Left Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0">
        <div className="h-14 px-5 border-b border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-bold tracking-tight shrink-0">
            P
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white whitespace-nowrap shrink-0">
            Packyatra Voice
          </span>
        </div>

        <div className="flex-1 px-3 py-4 flex flex-col gap-5 overflow-y-auto">
          <div>
            <div className="px-3 mb-2 text-[11px] font-medium text-slate-400">
              Operations Console
            </div>
            <nav className="flex flex-col gap-1" aria-label="Main navigation">
              {navItems.map((item) => {
                const active = safeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveScreen(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-3.5 border-t border-slate-800 space-y-3">
          <div className="px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/70 space-y-1 text-xs">
            <div className="font-medium text-slate-300">Voice Line</div>
            <div className="font-mono tabular-nums text-white font-medium">
              {status?.caller_id || '08047291107'}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className={status?.exotel_ready ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                {status?.exotel_ready ? 'Connected' : 'Not configured'}
              </span>
              {status?.account_sid_masked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono truncate">{status.account_sid_masked}</span>
                </>
              )}
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between gap-2.5 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {authUser.firstName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{roleLabel}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[82vw] bg-slate-900 text-slate-200 h-full flex flex-col border-r border-slate-800 z-50">
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  P
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-white">
                  Packyatra Voice
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-1">
              {navItems.map((item) => {
                const active = safeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3.5 border-t border-slate-800 text-xs space-y-3">
              <div className="px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/70 space-y-1">
                <div className="font-medium text-slate-300">Voice Line</div>
                <div className="font-mono tabular-nums text-white font-medium">
                  {status?.caller_id || '08047291107'}
                </div>
                <div className={status?.exotel_ready ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                  {status?.exotel_ready ? 'Connected' : 'Not configured'}
                </div>
              </div>
              <div className="pt-1 flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {authUser.firstName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{roleLabel}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  Sign out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 sticky top-0 z-20">
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
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Calls
          </button>
        </header>

        {/* Viewport Container */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
          <AudioPlayerBar
            call={playingCall}
            authToken={authToken}
            onUnauthorized={handleUnauthorized}
            onClose={() => setPlayingCall(null)}
          />

          {safeScreen === 'leads' ? (
            <LeadManagementScreen
              authToken={authToken}
              onUnauthorized={handleUnauthorized}
              onDialNumber={handleDialLeadNumber}
            />
          ) : safeScreen === 'my-leads' ? (
            <MyAssignedLeadsScreen
              authToken={authToken}
              authUser={authUser}
              onUnauthorized={handleUnauthorized}
              onDialNumber={handleDialLeadNumber}
            />
          ) : safeScreen === 'telephone' ? (
            <ExotelTelephoneScreen
              status={status}
              calls={calls}
              routes={routes}
              authToken={authToken}
              dialTargetOverride={dialTargetOverride}
              onUnauthorized={handleUnauthorized}
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
              authToken={authToken}
              onUnauthorized={handleUnauthorized}
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
