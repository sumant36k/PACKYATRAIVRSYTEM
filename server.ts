import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getEnv(name: string, fallback = ''): string {
  return (process.env[name] || fallback).trim();
}

const SESSION_SECRET = getEnv('SESSION_SECRET') || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const revokedTokenIds = new Map<string, number>();

type AppRole = 'admin' | 'support';

interface SessionPayload {
  jti: string;
  firstName: string;
  role: string;
  appRole: AppRole;
  email: string;
  iat: number;
  exp: number;
}

interface AuthedRequest extends Request {
  authSession?: SessionPayload;
}

const KNOWN_SUPPORT_FIRST_NAMES = new Set(['ashutosh', 'sana', 'sonu', 'test']);
const KNOWN_SUPPORT_EMAILS = new Set([
  'ashu@gmail.com',
  'sanaf1030@gmail.com',
  'sonu@packyatra.com',
  'test@gmail.com',
]);
const KNOWN_ADMIN_IDENTIFIERS = new Set([
  'admin',
  'administrator',
  'superadmin',
  'super admin',
  'owner',
  'ajeet',
  'ajeetmadhubani1@gmail.com',
]);

function getConfiguredAdminIdentifiers(): Set<string> {
  const configured = getEnv('ADMIN_USERS');
  if (!configured) return KNOWN_ADMIN_IDENTIFIERS;
  const merged = new Set(KNOWN_ADMIN_IDENTIFIERS);
  for (const item of configured.split(',')) {
    const cleaned = item.trim().toLowerCase();
    if (cleaned) merged.add(cleaned);
  }
  return merged;
}

function isAdminKeyword(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return (
    lower.includes('admin') ||
    lower.includes('super') ||
    lower.includes('owner') ||
    lower.includes('manager') ||
    lower.includes('director') ||
    lower.includes('founder') ||
    lower.includes('head') ||
    lower.includes('master')
  );
}

function extractNestedRoleLabel(obj: Record<string, unknown>): string {
  const nestedKeys = ['name', 'roleName', 'role_name', 'title', 'label', 'code', 'role', 'value'];
  for (const key of nestedKeys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
}

function resolveAppRole(rawRole?: string, firstName?: string, email?: string): AppRole {
  const normalized = (rawRole || '').trim().toLowerCase();
  if (normalized) {
    if (isAdminKeyword(normalized)) {
      return 'admin';
    }
    return 'support';
  }

  const normalizedName = (firstName || '').trim().toLowerCase();
  const normalizedFirstWord = normalizedName.split(/\s+/)[0] || '';
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (
    KNOWN_SUPPORT_FIRST_NAMES.has(normalizedName) ||
    KNOWN_SUPPORT_FIRST_NAMES.has(normalizedFirstWord) ||
    (normalizedEmail && KNOWN_SUPPORT_EMAILS.has(normalizedEmail))
  ) {
    return 'support';
  }

  const adminIdentifiers = getConfiguredAdminIdentifiers();
  if (
    adminIdentifiers.has(normalizedName) ||
    adminIdentifiers.has(normalizedFirstWord) ||
    (normalizedEmail && adminIdentifiers.has(normalizedEmail))
  ) {
    return 'admin';
  }

  return 'support';
}

function extractRoleDeep(body: unknown): string {
  const roleKeys = new Set([
    'role',
    'rolename',
    'role_name',
    'userrole',
    'user_role',
    'usertype',
    'user_type',
    'designation',
    'roles',
    'userroles',
    'user_roles',
    'accounttype',
    'account_type',
    'stafftype',
    'staff_type',
    'employeetype',
    'employee_type',
    'accesslevel',
    'access_level',
    'userlevel',
    'user_level',
    'profiletype',
    'profile_type',
    'rolecode',
    'role_code',
    'roletitle',
    'role_title',
    'department',
    'permissions',
    'authorities',
    'cognito:groups',
  ]);
  const adminFlagKeys = new Set([
    'isadmin',
    'is_admin',
    'admin',
    'issuperadmin',
    'is_super_admin',
    'superadmin',
    'isowner',
    'is_owner',
  ]);

  let foundRole = '';
  let explicitAdminFlag = false;
  let explicitNonAdminFlag = false;

  const queue: unknown[] = [body];
  const visited = new Set<object>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        if (item && typeof item === 'object') {
          queue.push(item);
        }
      }
      continue;
    }

    const record = current as Record<string, unknown>;

    const claimType =
      typeof record.type === 'string'
        ? record.type
        : typeof record.claimType === 'string'
        ? record.claimType
        : '';
    const claimVal =
      typeof record.value === 'string'
        ? record.value
        : typeof record.claimValue === 'string'
        ? record.claimValue
        : '';
    if (claimType && claimVal.trim() && claimType.toLowerCase().includes('role')) {
      if (isAdminKeyword(claimVal)) return claimVal.trim();
      if (!foundRole) foundRole = claimVal.trim();
    }

    for (const [k, v] of Object.entries(record)) {
      const keyLower = k.toLowerCase();

      if (adminFlagKeys.has(keyLower)) {
        if (v === true || v === 1 || String(v).trim().toLowerCase() === 'true') {
          explicitAdminFlag = true;
        } else if (v === false || v === 0 || String(v).trim().toLowerCase() === 'false') {
          explicitNonAdminFlag = true;
        }
      }

      const isRoleKey =
        roleKeys.has(keyLower) ||
        keyLower.endsWith('/role') ||
        keyLower.endsWith('/roles') ||
        keyLower.endsWith('claims/role') ||
        keyLower.endsWith('claims/roles');

      if (isRoleKey) {
        if (typeof v === 'string' && v.trim()) {
          if (isAdminKeyword(v)) return v.trim();
          if (!foundRole) foundRole = v.trim();
        } else if (Array.isArray(v)) {
          for (const item of v) {
            let candidate = '';
            if (typeof item === 'string' && item.trim()) {
              candidate = item.trim();
            } else if (item && typeof item === 'object' && !Array.isArray(item)) {
              candidate = extractNestedRoleLabel(item as Record<string, unknown>);
            }
            if (candidate) {
              if (isAdminKeyword(candidate)) return candidate;
              if (!foundRole) foundRole = candidate;
            }
          }
        } else if (v && typeof v === 'object') {
          const nested = extractNestedRoleLabel(v as Record<string, unknown>);
          if (nested) {
            if (isAdminKeyword(nested)) return nested;
            if (!foundRole) foundRole = nested;
          }
        }
      }

      if (v && typeof v === 'object') {
        queue.push(v);
      }
    }
  }

  if (foundRole) return foundRole;
  if (explicitAdminFlag) return 'Admin';
  if (explicitNonAdminFlag) return 'Customer Support';
  return '';
}

function pruneRevokedTokens() {
  const now = Date.now();
  for (const [jti, exp] of revokedTokenIds.entries()) {
    if (exp <= now) {
      revokedTokenIds.delete(jti);
    }
  }
}

function signSessionToken(user: { firstName: string; role?: string; email?: string }): string {
  const now = Date.now();
  const rawRole = user.role || '';
  const appRole = resolveAppRole(rawRole, user.firstName, user.email);
  const displayRole = rawRole || (appRole === 'admin' ? 'Admin' : 'Customer Support');
  const payload: SessionPayload = {
    jti: crypto.randomUUID(),
    firstName: user.firstName,
    role: displayRole,
    appRole,
    email: user.email || '',
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null;
    }
    if (!parsed.jti || revokedTokenIds.has(parsed.jti)) {
      return null;
    }
    if (typeof parsed.firstName !== 'string' || !parsed.firstName) {
      return null;
    }
    parsed.appRole =
      parsed.appRole === 'admin' || parsed.appRole === 'support'
        ? parsed.appRole
        : resolveAppRole(parsed.role, parsed.firstName, parsed.email);
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ code: 'AUTH_REQUIRED', detail: 'Authentication required. Please sign in.' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ code: 'SESSION_INVALID', detail: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.authSession = session;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authSession || req.authSession.appRole !== 'admin') {
    res.status(403).json({ detail: 'Admin access is required for this action.' });
    return;
  }
  next();
}

function mapUpstreamStatus(status: number): number {
  if (status === 401 || status === 403) return 502;
  return status >= 400 ? status : 502;
}

function getValidatedAuthApiBase(): string {
  const rawEnv = getEnv('VITE_APP_API_URL', 'https://packyatra.in/api')
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .replace(/\/+$/, '');
  const normalizedBase = rawEnv.replace(/\/auth\/login$/i, '');
  const parsed = new URL(normalizedBase);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Invalid VITE_APP_API_URL scheme');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '169.254.169.254' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error('VITE_APP_API_URL cannot target private or loopback hosts');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function normalizeIndianPhone(num: string, allowFallback = false): string {
  const digitsOnly = (num || '').replace(/\D/g, '');
  if (!digitsOnly) {
    if (!allowFallback) return '';
    const fallback = getEnv('MY_MOBILE_NUMBER', '+919916109192');
    return normalizeIndianPhone(fallback, false);
  }
  let digits = digitsOnly;
  if (digits.startsWith('00') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 13 && digits.startsWith('910')) {
    return `+91${digits.slice(3)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return '';
}

function normalizeCallerId(raw: string): string {
  const cleaned = (raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

function isAllowedExotelRecordingUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.exotel.com') ||
      host.endsWith('.exotel.in') ||
      host.endsWith('.amazonaws.com') ||
      host === 'exotel.com' ||
      host === 'exotel.in'
    );
  } catch {
    return false;
  }
}

async function exotelFetch(
  accountSid: string,
  apiKey: string,
  apiToken: string,
  apiPath: string,
  init: RequestInit = {}
): Promise<{ response: globalThis.Response; data: Record<string, any>; usedSubdomain: string }> {
  const explicitSubdomain = getEnv('EXOTEL_SUBDOMAIN');
  const candidates = explicitSubdomain
    ? [explicitSubdomain]
    : ['api.in.exotel.com', 'api.exotel.com'];
  const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');

  let lastResponse!: globalThis.Response;
  let lastData: Record<string, any> = {};
  let lastSubdomain = candidates[0];

  for (const sub of candidates) {
    lastSubdomain = sub;
    const url = `https://${sub}/v1/Accounts/${encodeURIComponent(accountSid)}${apiPath}`;
    const resp = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Basic ${authHeader}`,
        ...(init.headers || {}),
      },
    });
    const data = await resp.json().catch(() => ({}));
    lastResponse = resp;
    lastData = data;
    if (resp.status !== 401) {
      return { response: resp, data, usedSubdomain: sub };
    }
  }

  return { response: lastResponse, data: lastData, usedSubdomain: lastSubdomain };
}

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const exotelWebhookEvents: Array<{
    id: string;
    receivedAt: string;
    callSid: string;
    from: string;
    to: string;
    digits: string;
    status: string;
    recordingUrl: string;
  }> = [];

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'exotel-voice-console' });
  });

  app.post('/api/auth/login', async (req, res) => {
    const rawFirstName = req.body?.FirstName ?? req.body?.firstName;
    const rawPassword = req.body?.Password ?? req.body?.password;

    if (typeof rawFirstName !== 'string' || typeof rawPassword !== 'string') {
      res.status(400).json({ detail: 'FirstName and Password must be strings.' });
      return;
    }

    const firstName = rawFirstName.trim();
    const password = rawPassword;

    if (!firstName || !password) {
      res.status(400).json({ detail: 'First name and password are required.' });
      return;
    }

    if (firstName.length > 200 || password.length > 200) {
      res.status(400).json({ detail: 'Input exceeds maximum allowed length.' });
      return;
    }

    try {
      const apiBase = getValidatedAuthApiBase();
      const loginUrl = `${apiBase}/auth/login`;
      const upstreamRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'PackyatraVoiceConsole/1.0',
        },
        body: JSON.stringify({
          FirstName: firstName,
          Password: password,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const rawText = await upstreamRes.text();
      let parsedBody: unknown = {};
      if (rawText) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = { message: rawText };
        }
      }
      const upstreamData =
        parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
          ? (parsedBody as Record<string, any>)
          : {};

      const explicitFailure =
        upstreamData?.success === false ||
        upstreamData?.ok === false ||
        upstreamData?.status === false;

      if (!upstreamRes.ok || explicitFailure) {
        let errMsg =
          upstreamData?.message ||
          upstreamData?.Message ||
          upstreamData?.detail ||
          upstreamData?.title ||
          (explicitFailure ? 'Invalid first name or password' : `Authentication failed (HTTP ${upstreamRes.status})`);

        if (typeof errMsg === 'string' && /^\s*</.test(errMsg)) {
          errMsg = `Packyatra auth server is temporarily unavailable (HTTP ${upstreamRes.status}). Please try again.`;
        }

        if (upstreamData?.errors && typeof upstreamData.errors === 'object') {
          const msgs = Object.values(upstreamData.errors)
            .flat()
            .filter((v) => typeof v === 'string');
          if (msgs.length > 0) {
            errMsg = msgs.join(' ');
          }
        }

        const statusCode =
          upstreamRes.status >= 400 && upstreamRes.status < 500
            ? upstreamRes.status
            : explicitFailure
            ? 401
            : 502;
        res.status(statusCode).json({ detail: errMsg });
        return;
      }

      const userRecord =
        (upstreamData?.user as Record<string, any>) ||
        (upstreamData?.User as Record<string, any>) ||
        (upstreamData?.data as Record<string, any>) ||
        (upstreamData?.Data as Record<string, any>) ||
        upstreamData;
      const resolvedFirstName =
        String(
          userRecord?.firstName ||
            userRecord?.FirstName ||
            userRecord?.name ||
            userRecord?.Name ||
            userRecord?.username ||
            userRecord?.Username ||
            firstName
        ).trim() || firstName;
      const resolvedRole = extractRoleDeep(upstreamData);
      const resolvedEmail = String(userRecord?.email || userRecord?.Email || '').trim();
      const resolvedAppRole = resolveAppRole(resolvedRole, resolvedFirstName, resolvedEmail);
      const displayRole = resolvedRole || (resolvedAppRole === 'admin' ? 'Admin' : 'Customer Support');

      const token = signSessionToken({
        firstName: resolvedFirstName,
        role: displayRole,
        email: resolvedEmail,
      });

      res.json({
        token,
        user: {
          firstName: resolvedFirstName,
          role: displayRole,
          appRole: resolvedAppRole,
          email: resolvedEmail,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Packyatra auth server';
      console.error('Auth login upstream error:', msg);
      res.status(502).json({ detail: msg });
    }
  });

  app.post('/api/auth/exchange', (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const upstreamToken = typeof body.upstreamToken === 'string' ? body.upstreamToken.trim() : '';
    const rawUser = (body.user && typeof body.user === 'object' ? body.user : {}) as Record<string, unknown>;

    if (!upstreamToken || upstreamToken.length < 16 || upstreamToken.length > 4096) {
      res.status(401).json({ detail: 'Valid Packyatra authentication token is required.' });
      return;
    }

    let jwtClaims: Record<string, unknown> = {};
    const jwtParts = upstreamToken.split('.');
    if (jwtParts.length === 3) {
      try {
        const decoded = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'));
        if (decoded && typeof decoded === 'object') {
          jwtClaims = decoded as Record<string, unknown>;
          if (typeof jwtClaims.exp === 'number' && jwtClaims.exp * 1000 <= Date.now()) {
            res.status(401).json({ detail: 'Packyatra token has expired. Please sign in again.' });
            return;
          }
        }
      } catch {
        res.status(401).json({ detail: 'Malformed Packyatra authentication token.' });
        return;
      }
    }

    const firstName =
      String(
        jwtClaims.firstName ||
          jwtClaims.FirstName ||
          jwtClaims.unique_name ||
          jwtClaims.name ||
          rawUser.firstName ||
          'User'
      ).trim() || 'User';
    const email = String(
      jwtClaims.email ||
        jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        rawUser.email ||
        ''
    ).trim();
    const role = String(
      jwtClaims.role ||
        jwtClaims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        extractRoleDeep(jwtClaims) ||
        rawUser.role ||
        ''
    ).trim();
    const appRole = resolveAppRole(role, firstName, email);
    const displayRole = role || (appRole === 'admin' ? 'Admin' : 'Customer Support');

    const token = signSessionToken({ firstName, role: displayRole, email });
    res.json({
      token,
      user: { firstName, role: displayRole, appRole, email },
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const session = req.authSession!;
    res.json({
      user: {
        firstName: session.firstName,
        role: session.role,
        appRole: session.appRole,
        email: session.email,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    pruneRevokedTokens();
    const token = extractBearerToken(req);
    if (token) {
      const session = verifySessionToken(token);
      if (session) {
        revokedTokenIds.set(session.jti, session.exp);
      }
    }
    res.json({ ok: true });
  });

  app.get('/api/exotel/status', requireAuth, (_req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const subdomain = getEnv('EXOTEL_SUBDOMAIN') || 'auto (in / sg)';
    const callerId = getEnv('EXOTEL_CALLER_ID', '08047291107');
    const flowAppId = getEnv('EXOTEL_FLOW_APP_ID', '1386346');

    const missing = Object.entries({
      EXOTEL_ACCOUNT_SID: accountSid,
      EXOTEL_API_KEY: apiKey,
      EXOTEL_API_TOKEN: apiToken,
    })
      .filter(([, val]) => !val)
      .map(([k]) => k);

    const invalidAccountSid = Boolean(accountSid && /\s/.test(accountSid));

    res.json({
      status: missing.length === 0 && !invalidAccountSid ? 'ready' : 'unconfigured',
      exotel_ready: missing.length === 0 && !invalidAccountSid,
      account_sid_masked: accountSid ? `${accountSid.slice(0, 4)}...${accountSid.slice(-4)}` : '',
      invalid_account_sid: invalidAccountSid,
      subdomain,
      caller_id: callerId,
      trial_number: '09513886363',
      trial_pin: '9916-1091-92',
      flow_name: 'packyatra1 Landing Flow',
      flow_app_id: flowAppId,
      default_agent_mobile: getEnv('MY_MOBILE_NUMBER', '+919916109192'),
      missing_env: missing,
    });
  });

  app.post('/api/exotel/calls/bridge', requireAuth, async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const callerId = normalizeCallerId(
      String(req.body?.callerId || getEnv('EXOTEL_CALLER_ID', '08047291107'))
    );

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail: 'Missing voice telephony credentials in server environment.',
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail: 'Voice Account SID cannot contain spaces.',
      });
      return;
    }

    if (!callerId || callerId.replace(/\D/g, '').length < 8) {
      res.status(400).json({ detail: 'Invalid Caller ID. Set your active virtual number.' });
      return;
    }

    const fromNum = normalizeIndianPhone(
      String(req.body?.agentPhone || getEnv('MY_MOBILE_NUMBER', '+919916109192')),
      true
    );
    const toNum = normalizeIndianPhone(String(req.body?.destination || ''), false);

    if (!fromNum || !/^\+\d{10,15}$/.test(fromNum)) {
      res.status(400).json({ detail: 'Enter a valid Agent mobile number (10 digits or +91XXXXXXXXXX).' });
      return;
    }

    if (!toNum || !/^\+\d{10,15}$/.test(toNum)) {
      res.status(400).json({ detail: 'Enter a valid destination phone number (10 digits or +91XXXXXXXXXX).' });
      return;
    }

    if (fromNum === toNum) {
      res.status(400).json({
        detail: 'Agent number and destination number cannot be identical. Pick two different phone numbers.',
      });
      return;
    }

    try {
      const baseParams = {
        From: fromNum,
        To: toNum,
        CallerId: callerId,
        CallType: 'trans',
      };

      let { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        '/Calls/connect.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ ...baseParams, Record: 'true' }).toString(),
        }
      );

      // Some Exotel plans/trial accounts reject Record=true with 400 "Bad or missing parameters in request."
      const firstErr = String(data?.RestException?.Message || data?.message || '');
      if (response.status === 400 && /bad or missing parameters/i.test(firstErr)) {
        const retryResult = await exotelFetch(
          accountSid,
          apiKey,
          apiToken,
          '/Calls/connect.json',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(baseParams).toString(),
          }
        );
        response = retryResult.response;
        data = retryResult.data;
      }

      if (!response.ok) {
        const rawErr =
          data?.RestException?.Message || data?.message || `Voice API HTTP ${response.status}`;
        const detail =
          response.status === 400 && /bad or missing parameters/i.test(String(rawErr))
            ? `${rawErr} (Sent From=${fromNum}, To=${toNum}, CallerId=${callerId}. Verify virtual number and phone numbers are valid.)`
            : rawErr;
        res.status(mapUpstreamStatus(response.status)).json({ detail });
        return;
      }

      const callSid = data?.Call?.Sid || '';
      res.json({
        status: 'bridging',
        carrier: 'voice',
        call_sid: callSid,
        agent_phone: fromNum,
        destination: toNum,
        caller_id: callerId,
        message: `Ringing ${fromNum} from ${callerId}. Answer to connect 2-way voice to ${toNum}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Call request failed';
      res.status(500).json({ detail: msg });
    }
  });

  app.post('/api/exotel/calls/ivr', requireAuth, async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');
    const callerId = normalizeCallerId(
      String(req.body?.callerId || getEnv('EXOTEL_CALLER_ID', '08047291107'))
    );
    const flowAppId = String(req.body?.flowAppId || getEnv('EXOTEL_FLOW_APP_ID', '1386346')).trim();

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail: 'Missing voice telephony credentials in server environment.',
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail: 'Voice Account SID cannot contain spaces.',
      });
      return;
    }

    if (!callerId || callerId.replace(/\D/g, '').length < 8) {
      res.status(400).json({ detail: 'Invalid Caller ID. Set your active virtual number.' });
      return;
    }

    if (!flowAppId || !/^\d{3,16}$/.test(flowAppId)) {
      res.status(400).json({
        detail: 'Provide a valid numeric IVR Flow ID (e.g. 1386346).',
      });
      return;
    }

    const toNum = normalizeIndianPhone(
      String(req.body?.to || getEnv('MY_MOBILE_NUMBER', '+919916109192')),
      true
    );
    if (!toNum || !/^\+\d{10,15}$/.test(toNum)) {
      res.status(400).json({ detail: 'Enter a valid destination phone number (10 digits or +91XXXXXXXXXX).' });
      return;
    }

    const flowUrl = `http://my.exotel.com/${encodeURIComponent(accountSid)}/exoml/start_voice/${encodeURIComponent(flowAppId)}`;

    try {
      // Connect-to-Flow uses From + CallerId + Url (+ CallType); Record is configured inside the App Bazaar flow.
      const form = new URLSearchParams({
        From: toNum,
        CallerId: callerId,
        Url: flowUrl,
        CallType: 'trans',
      });

      const { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        '/Calls/connect.json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        }
      );

      if (!response.ok) {
        const rawErr =
          data?.RestException?.Message || data?.message || `Voice API HTTP ${response.status}`;
        const detail =
          response.status === 400 && /bad or missing parameters/i.test(String(rawErr))
            ? `${rawErr} (Sent From=${toNum}, CallerId=${callerId}, Flow=${flowAppId}. Verify Caller ID, Flow ID, and Account SID belong to the same account.)`
            : rawErr;
        res.status(mapUpstreamStatus(response.status)).json({ detail });
        return;
      }

      const callSid = data?.Call?.Sid || '';
      res.json({
        status: 'started',
        carrier: 'voice',
        call_sid: callSid,
        to: toNum,
        caller_id: callerId,
        flow_app_id: flowAppId,
        message: `Calling ${toNum} from ${callerId} with IVR Flow #${flowAppId}. Answer to hear Press 1/2/3 menu.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'IVR call failed';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/exotel/calls', requireAuth, async (_req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({
        detail: 'Telephony credentials are not configured in server environment.',
        missing_env: [
          ...(!accountSid ? ['EXOTEL_ACCOUNT_SID'] : []),
          ...(!apiKey ? ['EXOTEL_API_KEY'] : []),
          ...(!apiToken ? ['EXOTEL_API_TOKEN'] : []),
        ],
      });
      return;
    }

    if (/\s/.test(accountSid)) {
      res.status(400).json({
        detail: 'Voice Account SID cannot contain spaces.',
      });
      return;
    }

    try {
      const { response, data, usedSubdomain } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        '/Calls.json?PageSize=50'
      );

      if (!response.ok) {
        res.status(mapUpstreamStatus(response.status)).json({
          detail: data?.RestException?.Message || data?.message || `Voice API HTTP ${response.status}`,
          subdomain_tried: usedSubdomain,
        });
        return;
      }

      const rawCalls = Array.isArray(data?.Calls) ? data.Calls : [];
      const calls = rawCalls.map((item: Record<string, unknown>) => {
        const c = (item.Call as Record<string, unknown>) || item;
        const sid = String(c.Sid || '');
        const recordingUrl = String(c.RecordingUrl || '').trim();
        return {
          sid,
          from: String(c.From || ''),
          to: String(c.To || ''),
          phoneNumberSid: String(c.PhoneNumberSid || getEnv('EXOTEL_CALLER_ID', '08047291107')),
          status: String(c.Status || ''),
          direction: String(c.Direction || ''),
          duration: String(c.Duration || '0'),
          dateCreated: String(c.DateCreated || ''),
          recordingUrl,
          hasRecording: Boolean(recordingUrl),
          audioProxyUrl: recordingUrl ? `/api/exotel/calls/${encodeURIComponent(sid)}/recording` : '',
        };
      });

      res.json({
        calls,
        recordedCount: calls.filter((c: { hasRecording: boolean }) => c.hasRecording).length,
        subdomain: usedSubdomain,
        webhooks: exotelWebhookEvents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch calls';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/exotel/calls/:callSid/recording', requireAuth, async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({ detail: 'Missing telephony credentials' });
      return;
    }

    const callSid = String(req.params.callSid || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(callSid)) {
      res.status(400).json({ detail: 'Invalid callSid format' });
      return;
    }

    try {
      const { response, data, usedSubdomain } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        `/Calls/${encodeURIComponent(callSid)}.json`
      );
      if (!response.ok) {
        res.status(mapUpstreamStatus(response.status)).json({
          detail: data?.RestException?.Message || `Voice API HTTP ${response.status}`,
        });
        return;
      }

      const callObj = (data?.Call as Record<string, unknown>) || data;
      const recordingUrl = String(callObj?.RecordingUrl || '').trim();
      if (!recordingUrl) {
        res.status(404).json({
          detail: 'No recording exists for this call. Ensure recording is enabled in the IVR flow.',
        });
        return;
      }

      if (!isAllowedExotelRecordingUrl(recordingUrl)) {
        res.status(403).json({ detail: 'Recording URL host is not an authorized media domain.' });
        return;
      }

      const authHeader = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
      let audioResp = await fetch(recordingUrl, {
        headers: { Authorization: `Basic ${authHeader}` },
        redirect: 'follow',
      });

      if (!audioResp.ok) {
        const v3Url = `https://${usedSubdomain}/v3/accounts/${encodeURIComponent(
          accountSid
        )}/calls/${encodeURIComponent(callSid)}/voice-logs?format=mp3`;
        const v3Resp = await fetch(v3Url, {
          headers: { Authorization: `Basic ${authHeader}` },
          redirect: 'follow',
        });
        if (v3Resp.ok) {
          audioResp = v3Resp;
        }
      }

      if (!audioResp.ok) {
        res.status(mapUpstreamStatus(audioResp.status)).json({
          detail: `Unable to fetch recording audio (HTTP ${audioResp.status})`,
        });
        return;
      }

      const contentType = audioResp.headers.get('content-type') || 'audio/mpeg';
      const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(audioBuffer.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=300');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', `attachment; filename="call_${callSid}.mp3"`);
      }
      res.status(200).send(audioBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stream recording';
      res.status(500).json({ detail: msg });
    }
  });

  app.get('/api/exotel/calls/:callSid', requireAuth, async (req, res) => {
    const accountSid = getEnv('EXOTEL_ACCOUNT_SID');
    const apiKey = getEnv('EXOTEL_API_KEY');
    const apiToken = getEnv('EXOTEL_API_TOKEN');

    if (!accountSid || !apiKey || !apiToken) {
      res.status(400).json({ detail: 'Missing telephony credentials' });
      return;
    }

    const callSid = String(req.params.callSid || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(callSid)) {
      res.status(400).json({ detail: 'Invalid callSid format' });
      return;
    }

    try {
      const { response, data } = await exotelFetch(
        accountSid,
        apiKey,
        apiToken,
        `/Calls/${encodeURIComponent(callSid)}.json`
      );
      if (!response.ok) {
        res.status(mapUpstreamStatus(response.status)).json({
          detail: data?.RestException?.Message || `HTTP ${response.status}`,
        });
        return;
      }
      res.json({ call: data?.Call || data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch call';
      res.status(500).json({ detail: msg });
    }
  });

  app.all('/api/exotel/passthru', (req, res) => {
    const payload = { ...req.query, ...(req.body || {}) } as Record<string, unknown>;
    exotelWebhookEvents.unshift({
      id: `exo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      receivedAt: new Date().toISOString(),
      callSid: String(payload.CallSid || ''),
      from: String(payload.CallFrom || payload.From || ''),
      to: String(payload.CallTo || payload.To || getEnv('EXOTEL_CALLER_ID', '08047291107')),
      digits: String(payload.digits || payload.Digits || ''),
      status: String(payload.Status || payload.CallStatus || 'received'),
      recordingUrl: String(payload.RecordingUrl || ''),
    });
    if (exotelWebhookEvents.length > 50) exotelWebhookEvents.length = 50;
    res.status(200).json({ ok: true });
  });

  app.get('/api/exotel/webhooks', requireAuth, (_req, res) => {
    res.json({ events: exotelWebhookEvents });
  });

  const VALID_LEAD_STATUSES = new Set([
    'New',
    'Contacted',
    'In Follow-Up',
    'Quoted',
    'Converted',
    'Lost',
  ]);
  const VALID_MOVE_TYPES = new Set(['Local', 'Domestic', 'Commercial', 'Vehicle']);
  const VALID_SOURCES = new Set([
    'LogisticMart',
    'Sulekha',
    'Website',
    'Direct Call',
    'WhatsApp',
    'Referral',
    'SMS Alert',
    'Email Alert',
  ]);

  const supportReps = [
    { id: 'rep_ashutosh', name: 'Ashutosh singh', email: 'ashu@gmail.com', active: true },
    { id: 'rep_sana', name: 'Sana Fatima', email: 'sanaf1030@gmail.com', active: true },
    { id: 'rep_sonu', name: 'Sonu kumar', email: 'sonu@packyatra.com', active: true },
    { id: 'rep_test', name: 'Test kumar', email: 'test@gmail.com', active: false },
  ];

  let leadCounter = 1001;
  let ticketCounter = 5000;

  interface StoredFollowUpComment {
    id: string;
    createdAt: string;
    authorName: string;
    status: string;
    comment: string;
    nextFollowUpDate: string;
  }

  const leadsStore: Array<{
    id: string;
    createdAt: string;
    name: string;
    mobile: string;
    email: string;
    fromCity: string;
    toCity: string;
    moveType: string;
    requirement: string;
    source: string;
    assignedRepId: string;
    status: string;
    notes: string;
    ticketId: string;
    quotedAmount: string;
    followUpComments: StoredFollowUpComment[];
  }> = [
    {
      id: 'LD-1001',
      createdAt: '2026-11-23T09:30:00.000Z',
      name: 'Muskan Singh',
      mobile: '9093614628',
      email: 'muskansinghmuskan444@gmail.com',
      fromCity: 'Bangalore',
      toCity: 'Bangalore',
      moveType: 'Local',
      requirement: 'Local Household',
      source: 'LogisticMart',
      assignedRepId: '',
      status: 'New',
      notes: '',
      ticketId: '',
      quotedAmount: '',
      followUpComments: [],
    },
  ];

  function ensureSupportRepForSession(session?: SessionPayload): string {
    if (!session?.firstName) return '';
    const normalized = session.firstName.trim().toLowerCase();
    const existing = supportReps.find(
      (r) =>
        r.name.toLowerCase() === normalized ||
        r.name.toLowerCase().split(' ')[0] === normalized ||
        (session.email && r.email.toLowerCase() === session.email.toLowerCase())
    );
    if (existing) return existing.id;

    const slug = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'user';
    const newRep = {
      id: `rep_${slug}`,
      name: session.firstName,
      email: session.email || `${slug}@packyatra.com`,
      active: true,
    };
    supportReps.push(newRep);
    return newRep.id;
  }

  app.get('/api/leads', requireAuth, (req: AuthedRequest, res) => {
    const session = req.authSession!;
    const repId = session.appRole === 'admin' ? '' : ensureSupportRepForSession(session);
    const scopedLeads =
      session.appRole === 'admin'
        ? leadsStore
        : leadsStore.filter((l) => Boolean(repId) && l.assignedRepId === repId);

    res.json({
      leads: scopedLeads,
      reps: supportReps,
    });
  });

  app.post('/api/leads', requireAuth, requireAdmin, (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const fromCity = typeof body.fromCity === 'string' ? body.fromCity.trim() : '';
    const toCity = typeof body.toCity === 'string' ? body.toCity.trim() : '';
    const requirement = typeof body.requirement === 'string' ? body.requirement.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';
    const moveTypeRaw = typeof body.moveType === 'string' ? body.moveType.trim() : 'Local';
    const sourceRaw = typeof body.source === 'string' ? body.source.trim() : 'LogisticMart';
    const statusRaw = typeof body.status === 'string' ? body.status.trim() : 'New';
    const assignedRepRaw = typeof body.assignedRepId === 'string' ? body.assignedRepId.trim() : '';

    if (!name || name.length > 120) {
      res.status(400).json({ detail: 'Customer name is required (max 120 characters).' });
      return;
    }
    if (!mobile || mobile.length > 24) {
      res.status(400).json({ detail: 'Valid mobile number is required.' });
      return;
    }

    const moveType = VALID_MOVE_TYPES.has(moveTypeRaw) ? moveTypeRaw : 'Domestic';
    const source = VALID_SOURCES.has(sourceRaw) ? sourceRaw : 'LogisticMart';
    const status = VALID_LEAD_STATUSES.has(statusRaw) ? statusRaw : 'New';
    const assignedRepId =
      assignedRepRaw && supportReps.some((r) => r.id === assignedRepRaw) ? assignedRepRaw : '';

    leadCounter += 1;
    const newLead = {
      id: `LD-${leadCounter}`,
      createdAt: new Date().toISOString(),
      name,
      mobile,
      email: email.slice(0, 120),
      fromCity: (fromCity || 'Bangalore').slice(0, 80),
      toCity: (toCity || fromCity || 'Bangalore').slice(0, 80),
      moveType,
      requirement: (requirement || 'Household Shifting').slice(0, 140),
      source,
      assignedRepId,
      status,
      notes,
      ticketId: '',
      quotedAmount: '',
      followUpComments: [],
    };

    leadsStore.unshift(newLead);
    res.status(201).json({ lead: newLead });
  });

  app.patch('/api/leads/:id', requireAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id || '').trim();
    const idx = leadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: 'Lead not found.' });
      return;
    }

    const session = req.authSession!;
    const current = leadsStore[idx];
    const isAdmin = session.appRole === 'admin';
    if (!isAdmin) {
      const repId = ensureSupportRepForSession(session);
      if (!repId || current.assignedRepId !== repId) {
        res.status(403).json({ detail: 'You can only update leads assigned to you.' });
        return;
      }
    }

    const body = (req.body || {}) as Record<string, unknown>;

    if (typeof body.assignedRepId === 'string') {
      if (!isAdmin) {
        res.status(403).json({ detail: 'Only Admin can assign or reassign leads.' });
        return;
      }
      const repId = body.assignedRepId.trim();
      if (repId && !supportReps.some((r) => r.id === repId)) {
        res.status(400).json({ detail: 'Invalid support representative selected.' });
        return;
      }
      current.assignedRepId = repId;
    }

    if (typeof body.status === 'string') {
      const st = body.status.trim();
      if (!VALID_LEAD_STATUSES.has(st)) {
        res.status(400).json({ detail: 'Invalid lead status.' });
        return;
      }
      current.status = st;
    }

    if (isAdmin) {
      if (typeof body.name === 'string' && body.name.trim()) {
        current.name = body.name.trim().slice(0, 120);
      }
      if (typeof body.mobile === 'string' && body.mobile.trim()) {
        current.mobile = body.mobile.trim().slice(0, 24);
      }
      if (typeof body.email === 'string') {
        current.email = body.email.trim().slice(0, 120);
      }
      if (typeof body.fromCity === 'string' && body.fromCity.trim()) {
        current.fromCity = body.fromCity.trim().slice(0, 80);
      }
      if (typeof body.toCity === 'string' && body.toCity.trim()) {
        current.toCity = body.toCity.trim().slice(0, 80);
      }
      if (typeof body.moveType === 'string' && VALID_MOVE_TYPES.has(body.moveType.trim())) {
        current.moveType = body.moveType.trim();
      }
      if (typeof body.requirement === 'string' && body.requirement.trim()) {
        current.requirement = body.requirement.trim().slice(0, 140);
      }
      if (typeof body.source === 'string' && VALID_SOURCES.has(body.source.trim())) {
        current.source = body.source.trim();
      }
    }

    if (typeof body.notes === 'string') {
      current.notes = body.notes.trim().slice(0, 500);
    }
    if (typeof body.quotedAmount === 'string') {
      current.quotedAmount = body.quotedAmount.trim().slice(0, 40);
    }

    res.json({ lead: current });
  });

  app.post('/api/leads/:id/convert', requireAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id || '').trim();
    const lead = leadsStore.find((l) => l.id === id);
    if (!lead) {
      res.status(404).json({ detail: 'Lead not found.' });
      return;
    }

    const session = req.authSession!;
    const isAdmin = session.appRole === 'admin';
    if (!isAdmin) {
      const repId = ensureSupportRepForSession(session);
      if (!repId || lead.assignedRepId !== repId) {
        res.status(403).json({ detail: 'You can only convert leads assigned to you.' });
        return;
      }
    }

    const body = (req.body || {}) as Record<string, unknown>;
    if (!lead.ticketId) {
      ticketCounter += 1;
      lead.ticketId = `TKT-${ticketCounter}`;
    }
    lead.status = 'Converted';
    if (typeof body.quotedAmount === 'string') {
      lead.quotedAmount = body.quotedAmount.trim().slice(0, 40);
    }
    if (typeof body.notes === 'string' && body.notes.trim()) {
      lead.notes = body.notes.trim().slice(0, 500);
    }
    if (isAdmin && typeof body.assignedRepId === 'string') {
      const repId = body.assignedRepId.trim();
      if (!repId || supportReps.some((r) => r.id === repId)) {
        lead.assignedRepId = repId;
      }
    }

    res.json({ lead });
  });

  app.post('/api/leads/:id/comments', requireAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id || '').trim();
    const lead = leadsStore.find((l) => l.id === id);
    if (!lead) {
      res.status(404).json({ detail: 'Lead not found.' });
      return;
    }

    const session = req.authSession!;
    if (session.appRole !== 'admin') {
      const repId = ensureSupportRepForSession(session);
      if (!repId || lead.assignedRepId !== repId) {
        res.status(403).json({ detail: 'You can only comment on leads assigned to you.' });
        return;
      }
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const statusRaw = typeof body.status === 'string' ? body.status.trim() : '';
    const nextFollowUpDate =
      typeof body.nextFollowUpDate === 'string'
        ? body.nextFollowUpDate.trim().slice(0, 40)
        : '';

    if (!comment || comment.length > 1000) {
      res.status(400).json({ detail: 'Follow-up comment is required (max 1000 characters).' });
      return;
    }

    if (statusRaw && !VALID_LEAD_STATUSES.has(statusRaw)) {
      res.status(400).json({ detail: 'Invalid lead status selected.' });
      return;
    }

    if (statusRaw) {
      lead.status = statusRaw;
    }

    const entry: StoredFollowUpComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      authorName: session.firstName || 'Support Rep',
      status: lead.status,
      comment,
      nextFollowUpDate,
    };

    lead.followUpComments.unshift(entry);
    lead.notes = comment.slice(0, 500);

    res.status(201).json({ lead, comment: entry });
  });

  app.delete('/api/leads/:id', requireAuth, requireAdmin, (req, res) => {
    const id = String(req.params.id || '').trim();
    const idx = leadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: 'Lead not found.' });
      return;
    }
    leadsStore.splice(idx, 1);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Packyatra Exotel Console running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
