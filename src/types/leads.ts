export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'In Follow-Up'
  | 'Quoted'
  | 'Converted'
  | 'Lost';

export type LeadSource =
  | 'LogisticMart'
  | 'Sulekha'
  | 'Website'
  | 'Direct Call'
  | 'WhatsApp'
  | 'Referral'
  | 'SMS Alert'
  | 'Email Alert';

export type MoveType = 'Local' | 'Domestic' | 'Commercial' | 'Vehicle';

export interface SupportRep {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

export interface FollowUpComment {
  id: string;
  createdAt: string;
  authorName: string;
  status: LeadStatus;
  comment: string;
  nextFollowUpDate?: string;
}

export interface LeadRecord {
  id: string;
  createdAt: string;
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
  notes?: string;
  ticketId?: string;
  quotedAmount?: string;
  followUpComments?: FollowUpComment[];
}

export const LEAD_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'In Follow-Up',
  'Quoted',
  'Converted',
  'Lost',
];

export const LEAD_SOURCES: LeadSource[] = [
  'LogisticMart',
  'Sulekha',
  'Website',
  'Direct Call',
  'WhatsApp',
  'Referral',
  'SMS Alert',
  'Email Alert',
];

export const MOVE_TYPES: MoveType[] = ['Local', 'Domestic', 'Commercial', 'Vehicle'];

export function formatLeadDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
