import { LeadSource, MoveType } from '../types/leads';

export interface ParsedPortalLead {
  name: string;
  mobile: string;
  email: string;
  fromCity: string;
  toCity: string;
  moveType: MoveType;
  requirement: string;
  source: LeadSource;
}

export function parsePortalAlertText(rawText: string): ParsedPortalLead {
  const text = rawText.replace(/\s+/g, ' ').trim();

  // Extract Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].trim() : '';

  // Extract 10-digit Indian mobile number
  const mobileMatch = text.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/);
  const mobile = mobileMatch ? mobileMatch[1] : '';

  // Extract Name
  let name = '';
  const nameLabelMatch = text.match(
    /(?:Name|Customer|Client)\s*[:\-]?\s*([A-Za-z][A-Za-z.\s]{1,40}?)(?=\s+(?:Mobile|Phone|Mob|Contact|Email|Mail|Shifting|From|City|Need|Req|Source|Move)\b|$)/i
  );
  if (nameLabelMatch) {
    name = nameLabelMatch[1].trim();
  }

  // Extract From / To City
  let fromCity = '';
  let toCity = '';
  const routeMatch = text.match(
    /(?:Shifting\s+)?From\s*[:\-]?\s*([A-Za-z\s]{2,30}?)\s+To\s*[:\-]?\s*([A-Za-z\s]{2,30}?)(?=\s+(?:Need|Requirement|Move|Source|Email|Mobile|Phone|On|Date)\b|$)/i
  );
  if (routeMatch) {
    fromCity = routeMatch[1].trim();
    toCity = routeMatch[2].trim();
  } else {
    const arrowMatch = text.match(/([A-Za-z]{2,25})\s*(?:->|→|to)\s*([A-Za-z]{2,25})/i);
    if (arrowMatch) {
      fromCity = arrowMatch[1].trim();
      toCity = arrowMatch[2].trim();
    }
  }

  // Extract Requirement / Need
  let requirement = '';
  const needMatch = text.match(
    /(?:Need|Requirement|Req|Items?|Size)\s*[:\-]?\s*(.+?)(?=\s+(?:Source|Portal|Date|Mobile|Email)\b|$)/i
  );
  if (needMatch) {
    requirement = needMatch[1].trim();
  } else {
    const bhkMatch = text.match(/\b([1-5]\s*BHK(?:\s+Household)?|Local\s+Household|Office\s+Shifting|Car\s+Transport|Bike\s+Transport)\b/i);
    if (bhkMatch) {
      requirement = bhkMatch[1].trim();
    }
  }

  // Detect Source
  const lower = text.toLowerCase();
  let source: LeadSource = 'LogisticMart';
  if (lower.includes('sulekha')) source = 'Sulekha';
  else if (lower.includes('whatsapp')) source = 'WhatsApp';
  else if (lower.includes('sms')) source = 'SMS Alert';
  else if (lower.includes('email alert')) source = 'Email Alert';
  else if (lower.includes('website') || lower.includes('web')) source = 'Website';
  else if (lower.includes('call')) source = 'Direct Call';
  else if (lower.includes('referral')) source = 'Referral';

  // Detect Move Type
  let moveType: MoveType = 'Domestic';
  if (lower.includes('office') || lower.includes('commercial')) {
    moveType = 'Commercial';
  } else if (lower.includes('car') || lower.includes('bike') || lower.includes('vehicle')) {
    moveType = 'Vehicle';
  } else if (
    lower.includes('local') ||
    (fromCity && toCity && fromCity.toLowerCase() === toCity.toLowerCase())
  ) {
    moveType = 'Local';
  }

  return {
    name,
    mobile,
    email,
    fromCity: fromCity || 'Bangalore',
    toCity: toCity || fromCity || 'Bangalore',
    moveType,
    requirement: requirement || 'Household Shifting',
    source,
  };
}
