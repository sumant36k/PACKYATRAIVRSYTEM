import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Phone, User } from 'lucide-react';
import { AuthUser, extractRoleDeep, resolveAppRole } from '../types/exotel';

interface LoginScreenProps {
  sessionNotice?: string | null;
  onLoginSuccess: (token: string, user: AuthUser) => void;
}

function getAuthEndpointUrl(): { baseUrl: string; loginUrl: string } {
  const raw =
    (import.meta.env.VITE_APP_API_URL as string | undefined) ||
    'https://packyatra.in/api';
  const cleaned = raw
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/auth\/login$/i, '');
  const baseUrl = cleaned || 'https://packyatra.in/api';
  return {
    baseUrl,
    loginUrl: `${baseUrl}/auth/login`,
  };
}

function extractErrorMessage(
  parsedBody: unknown,
  fallbackStatus: number,
  explicitFailure: boolean
): string {
  if (typeof parsedBody === 'string' && parsedBody.trim()) {
    if (/^\s*</.test(parsedBody)) {
      return `Packyatra auth server is temporarily unavailable (HTTP ${fallbackStatus}). Please try again.`;
    }
    return parsedBody.trim();
  }
  if (parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)) {
    const obj = parsedBody as Record<string, any>;
    if (obj.errors && typeof obj.errors === 'object') {
      const msgs = Object.values(obj.errors)
        .flat()
        .filter((v) => typeof v === 'string');
      if (msgs.length > 0) return msgs.join(' ');
    }
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
    if (typeof obj.Message === 'string' && obj.Message.trim()) return obj.Message.trim();
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail.trim();
    if (typeof obj.title === 'string' && obj.title.trim()) return obj.title.trim();
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
  }
  return explicitFailure
    ? 'Invalid first name or password'
    : `Sign in failed (HTTP ${fallbackStatus}). Check your credentials and try again.`;
}

function safeJsonParse(rawText: string): unknown {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function extractTokenDeep(body: unknown, headerAuth: string): string {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.length >= 16 && !/^\s*</.test(trimmed)) {
      return trimmed;
    }
  }

  const tokenKeys = new Set([
    'token',
    'accesstoken',
    'access_token',
    'jwt',
    'jwttoken',
    'jwt_token',
    'authtoken',
    'auth_token',
    'tokenstring',
    'sessiontoken',
    'idtoken',
    'id_token',
  ]);

  const queue: unknown[] = [body];
  const visited = new Set<object>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [k, v] of Object.entries(current as Record<string, unknown>)) {
      if (typeof v === 'string' && tokenKeys.has(k.toLowerCase()) && v.trim()) {
        return v.trim();
      }
      if (v && typeof v === 'object') {
        queue.push(v);
      }
    }
  }

  if (/^Bearer\s+(.+)$/i.test(headerAuth)) {
    return headerAuth.replace(/^Bearer\s+/i, '').trim();
  }

  return '';
}


export const LoginScreen: React.FC<LoginScreenProps> = ({
  sessionNotice,
  onLoginSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loginUrl } = getAuthEndpointUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = firstName.trim();
    if (!trimmedName || !password) {
      setError('Enter both your first name and password to sign in.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Authenticate directly against VITE_APP_API_URL (/auth/login) from the browser
      let directRes: Response | null = null;
      let directBody: unknown = null;
      let directFailedWithNetworkError = false;

      try {
        directRes = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            FirstName: trimmedName,
            Password: password,
          }),
        });
        const rawText = await directRes.text();
        directBody = safeJsonParse(rawText);
      } catch {
        directFailedWithNetworkError = true;
      }

      if (!directFailedWithNetworkError && directRes) {
        const obj =
          directBody && typeof directBody === 'object' && !Array.isArray(directBody)
            ? (directBody as Record<string, any>)
            : {};

        const explicitFailure =
          obj?.success === false ||
          obj?.Success === false ||
          obj?.ok === false ||
          obj?.status === false;

        if (!directRes.ok || explicitFailure) {
          setError(extractErrorMessage(directBody, directRes.status, explicitFailure));
          return;
        }

        const isHtmlString =
          typeof directBody === 'string' && /^\s*</.test(directBody);

        if (isHtmlString) {
          setError(
            `Unexpected HTML response from ${loginUrl} (HTTP ${directRes.status}). Verify VITE_APP_API_URL.`
          );
          return;
        }

        const headerAuth = directRes.headers.get('authorization') || '';
        const upstreamToken = extractTokenDeep(directBody, headerAuth);

        const userObj = (obj?.user ||
          obj?.User ||
          obj?.data?.user ||
          obj?.result?.user ||
          obj?.data ||
          obj?.Data ||
          obj) as Record<string, any>;
        const resolvedFirstName =
          String(
            userObj?.firstName ||
              userObj?.FirstName ||
              userObj?.name ||
              userObj?.Name ||
              userObj?.username ||
              userObj?.Username ||
              trimmedName
          ).trim() || trimmedName;
        const resolvedRole = extractRoleDeep(directBody);
        const resolvedEmail = String(userObj?.email || userObj?.Email || '').trim();
        const resolvedUser: AuthUser = {
          firstName: resolvedFirstName,
          role: resolvedRole,
          appRole: resolveAppRole(resolvedRole, resolvedFirstName, resolvedEmail),
          email: resolvedEmail,
        };

        // 2a. If Packyatra returned a token, exchange it for a local server session token
        if (upstreamToken) {
          try {
            const exchangeRes = await fetch('/api/auth/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                upstreamToken,
                user: resolvedUser,
              }),
            });
            const exchangeText = await exchangeRes.text();
            const exchangeData = safeJsonParse(exchangeText);
            if (
              exchangeRes.ok &&
              exchangeData &&
              typeof exchangeData === 'object' &&
              'token' in exchangeData &&
              typeof (exchangeData as Record<string, unknown>).token === 'string'
            ) {
              const ex = exchangeData as { token: string; user?: AuthUser };
              onLoginSuccess(ex.token, ex.user || resolvedUser);
              return;
            }
          } catch {
            // Fall through to upstream token if exchange route is unavailable
          }

          onLoginSuccess(upstreamToken, resolvedUser);
          return;
        }

        // 2b. If Packyatra returned 200 OK user profile without a token field,
        // verify credentials via /api/auth/login on our server to mint a signed session token.
        const serverLoginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            FirstName: trimmedName,
            Password: password,
          }),
        });
        const serverLoginText = await serverLoginRes.text();
        const serverLoginData = safeJsonParse(serverLoginText);
        const serverObj =
          serverLoginData &&
          typeof serverLoginData === 'object' &&
          !Array.isArray(serverLoginData)
            ? (serverLoginData as Record<string, any>)
            : {};

        if (serverLoginRes.ok && typeof serverObj?.token === 'string' && serverObj.token) {
          onLoginSuccess(serverObj.token, serverObj.user || resolvedUser);
          return;
        }

        setError(
          extractErrorMessage(serverLoginData, serverLoginRes.status, false)
        );
        return;
      }

      // Fallback to server-side proxy if direct browser CORS request could not connect
      const proxyRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FirstName: trimmedName,
          Password: password,
        }),
      });
      const proxyText = await proxyRes.text();
      const proxyData = safeJsonParse(proxyText);
      const proxyObj =
        proxyData && typeof proxyData === 'object' && !Array.isArray(proxyData)
          ? (proxyData as Record<string, any>)
          : {};

      if (!proxyRes.ok || !proxyObj?.token) {
        setError(extractErrorMessage(proxyData, proxyRes.status, false));
        return;
      }

      const proxyFirstName = proxyObj?.user?.firstName || trimmedName;
      const proxyRole = proxyObj?.user?.role || '';
      const proxyEmail = proxyObj?.user?.email || '';
      onLoginSuccess(proxyObj.token, {
        firstName: proxyFirstName,
        role: proxyRole,
        appRole:
          proxyObj?.user?.appRole ||
          resolveAppRole(proxyRole, proxyFirstName, proxyEmail),
        email: proxyEmail,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach authentication service.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Minimal Corporate Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
            P
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Packyatra Voice
          </span>
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          Operations &amp; Call Console
        </span>
      </header>

      {/* Main Centered Auth Workspace */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-xs">
          {/* Left Panel: Corporate Console Overview */}
          <div className="lg:col-span-5 bg-slate-900 text-white p-8 sm:p-10 flex flex-col justify-between gap-8">
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-400/30 text-blue-300 flex items-center justify-center mb-6">
                <Phone className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white text-balance leading-snug">
                Packyatra Voice Console
              </h1>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                Sign in with your Packyatra account to manage customer leads, place outbound 2-way calls, configure IVR routing, and review call recordings.
              </p>
            </div>

            <div className="border-t border-slate-800 pt-5 space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Lead Pipeline</span>
                <span className="text-slate-100 font-medium">Allocation &amp; Follow-Ups</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Dialer &amp; Bridge</span>
                <span className="font-mono tabular-nums text-slate-100">+91 Voice</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Audit Logs</span>
                <span className="text-slate-100 font-medium">MP3 Playback &amp; CSV</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Sign-In Form */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your Packyatra first name and password to access your workspace.
              </p>
            </div>

            {sessionNotice && !error && (
              <div
                role="status"
                className="mb-5 px-3.5 py-3 rounded-lg border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{sessionNotice}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 px-3.5 py-3 rounded-lg border border-red-200 bg-red-50/70 text-xs text-red-900 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-first-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  First Name
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="login-first-name"
                    name="FirstName"
                    type="text"
                    autoComplete="username"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    disabled={submitting}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="login-password"
                    name="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={submitting}
                    className="w-full pl-10 pr-11 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 p-2 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 px-5 mt-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
