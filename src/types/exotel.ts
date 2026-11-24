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
