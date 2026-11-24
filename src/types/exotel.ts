export type AppRole = 'admin' | 'support';

export interface AuthUser {
  firstName: string;
  role?: string;
  appRole?: AppRole;
  email?: string;
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

export function extractRoleDeep(body: unknown): string {
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

    // Handle ASP.NET / OIDC claim objects like { type: ".../claims/role", value: "Admin" }
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

export function resolveAppRole(
  rawRole?: string,
  firstName?: string,
  email?: string
): AppRole {
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

  if (
    KNOWN_ADMIN_IDENTIFIERS.has(normalizedName) ||
    KNOWN_ADMIN_IDENTIFIERS.has(normalizedFirstWord) ||
    (normalizedEmail && KNOWN_ADMIN_IDENTIFIERS.has(normalizedEmail))
  ) {
    return 'admin';
  }

  return 'support';
}

export interface ExotelStatus {
  status: 'ready' | 'unconfigured';
  exotel_ready: boolean;
  account_sid_masked: string;
  invalid_account_sid: boolean;
  subdomain: string;
  caller_id: string;
  trial_number: string;
  trial_pin: string;
  flow_name: string;
  flow_app_id: string;
  default_agent_mobile: string;
  missing_env: string[];
}

export interface ExotelCallRecord {
  sid: string;
  from: string;
  to: string;
  phoneNumberSid: string;
  status: string;
  direction: string;
  duration: string;
  dateCreated: string;
  recordingUrl: string;
  hasRecording: boolean;
  audioProxyUrl: string;
}

export interface IvrRouteEntry {
  key: string;
  label: string;
  phone: string;
}

export const DEFAULT_IVR_ROUTES: IvrRouteEntry[] = [
  { key: '1', label: 'Owner Desk', phone: '+919916109192' },
  { key: '2', label: 'Contact 1', phone: '+919199225154' },
  { key: '3', label: 'Contact 2', phone: '+919620303042' },
];

export function formatDuration(secondsRaw: string | number): string {
  const total = Math.max(0, Number.parseInt(String(secondsRaw || '0'), 10) || 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatCallTime(raw: string): string {
  if (!raw) return '—';
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDirection(raw: string): 'Inbound' | 'Outbound' {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('inbound') || lower.includes('incoming')) return 'Inbound';
  return 'Outbound';
}
