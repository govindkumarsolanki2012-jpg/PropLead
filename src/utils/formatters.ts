import {
  LeadPriority,
  LeadStatus,
  PropertyType,
  RequirementType,
  PropertyStatus,
  PropertyTransactionType,
  FurnishingStatus,
} from '../types';

/**
 * Format numbers in Indian currency style: ₹ Lakhs / Crores / Thousands
 */
export function formatIndianCurrency(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
    return 'Budget on request';
  }

  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr % 1 === 0 ? cr : cr.toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    const lakh = amount / 100000;
    return `₹${lakh % 1 === 0 ? lakh : lakh.toFixed(2)} L`;
  }
  if (amount >= 1000) {
    const k = amount / 1000;
    return `₹${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatBudgetRange(min?: number, max?: number): string {
  if (!min && !max) return 'Flexible Budget';
  if (min && max) {
    if (min === max) return formatIndianCurrency(min);
    return `${formatIndianCurrency(min)} - ${formatIndianCurrency(max)}`;
  }
  if (min && !max) return `${formatIndianCurrency(min)}+`;
  if (!min && max) return `Up to ${formatIndianCurrency(max)}`;
  return 'Flexible Budget';
}

/**
 * Clean phone number for WhatsApp wa.me link (+91 prefix without spaces or dashes)
 */
export function cleanIndianPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length > 10 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

export function formatDisplayPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const rest = digits.slice(2);
    return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }
  return phone;
}

/**
 * Date relative string (e.g. "Today", "Tomorrow", "Yesterday", "24 Aug 2026")
 */
export function formatRelativeDate(dateStr?: string, timeStr?: string): { text: string; isOverdue: boolean; isToday: boolean; isTomorrow: boolean } {
  if (!dateStr) {
    return { text: 'No follow-up set', isOverdue: false, isToday: false, isTomorrow: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let timeFormatted = '';
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hourNum = parseInt(hours, 10);
    if (!isNaN(hourNum)) {
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const formattedHour = hourNum % 12 || 12;
      timeFormatted = ` at ${formattedHour}:${minutes || '00'} ${ampm}`;
    }
  }

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      text: absDays === 1 ? `Yesterday${timeFormatted}` : `${absDays} days overdue`,
      isOverdue: true,
      isToday: false,
      isTomorrow: false,
    };
  }

  if (diffDays === 0) {
    return {
      text: `Today${timeFormatted}`,
      isOverdue: false,
      isToday: true,
      isTomorrow: false,
    };
  }

  if (diffDays === 1) {
    return {
      text: `Tomorrow${timeFormatted}`,
      isOverdue: false,
      isToday: false,
      isTomorrow: true,
    };
  }

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const formatted = targetDate.toLocaleDateString('en-IN', options);

  return {
    text: `${formatted}${timeFormatted}`,
    isOverdue: false,
    isToday: false,
    isTomorrow: false,
  };
}

export function formatDateTime(isoOrDateStr: string): string {
  try {
    const date = new Date(isoOrDateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoOrDateStr;
  }
}

export const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; bg: string; text: string; border: string; iconColor: string; stageNumber: number }
> = {
  new: {
    label: 'New Lead',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    iconColor: '#0284c7',
    stageNumber: 1,
  },
  contacted: {
    label: 'Contacted',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    iconColor: '#6366f1',
    stageNumber: 2,
  },
  site_visit_scheduled: {
    label: 'Visit Scheduled',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: '#d97706',
    stageNumber: 3,
  },
  site_visit_completed: {
    label: 'Visit Completed',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    iconColor: '#ea580c',
    stageNumber: 4,
  },
  negotiation: {
    label: 'Negotiation',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    iconColor: '#9333ea',
    stageNumber: 5,
  },
  advance_paid: {
    label: 'Advance Paid',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    iconColor: '#0d9488',
    stageNumber: 6,
  },
  closed: {
    label: 'Deal Won / Closed',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconColor: '#059669',
    stageNumber: 7,
  },
  lost: {
    label: 'Lost / Dropped',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-300 dark:border-slate-700',
    iconColor: '#64748b',
    stageNumber: 8,
  },
};

export const PRIORITY_CONFIG: Record<LeadPriority, { label: string; badge: string; emoji: string; text: string }> = {
  hot: {
    label: 'Hot Lead',
    badge: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    emoji: '🔥',
    text: 'text-rose-600 dark:text-rose-400',
  },
  warm: {
    label: 'Warm',
    badge: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    emoji: '☀️',
    text: 'text-amber-600 dark:text-amber-400',
  },
  cold: {
    label: 'Cold',
    badge: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    emoji: '❄️',
    text: 'text-blue-600 dark:text-blue-400',
  },
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  flat: 'Apartment / Flat',
  house: 'Independent House',
  villa: 'Gated Villa',
  plot: 'Residential Plot',
  commercial: 'Commercial / Shop / Office',
  land: 'Agricultural Land / Farm',
  penthouse: 'Penthouse / Duplex',
  farmhouse: 'Farmhouse',
};

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, { label: string; badge: string }> = {
  buy: { label: 'Buyer', badge: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' },
  sell: { label: 'Seller / Owner', badge: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' },
  rent: { label: 'Tenant', badge: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' },
  lease: { label: 'Commercial Lease', badge: 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300' },
};

export const PROPERTY_STATUS_CONFIG: Record<
  PropertyStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  available: {
    label: 'Available',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  hold: {
    label: 'On Hold',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  negotiation: {
    label: 'Negotiation',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  sold_rented: {
    label: 'Sold / Rented',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

export const FURNISHING_LABELS: Record<FurnishingStatus, string> = {
  unfurnished: 'Unfurnished',
  semi_furnished: 'Semi-Furnished',
  fully_furnished: 'Fully Furnished',
};

export const TRANSACTION_TYPE_LABELS: Record<PropertyTransactionType, { label: string; badge: string }> = {
  sale: { label: 'For Sale', badge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  rent: { label: 'For Rent', badge: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  lease: { label: 'Commercial Lease', badge: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
};

