import { cleanIndianPhone, formatIndianCurrency } from './formatters';
import { Lead } from '../types';

export interface WhatsAppTemplate {
  id: string;
  title: string;
  category: 'Greeting' | 'Property Details' | 'Site Visit' | 'Follow-up' | 'Closing';
  getMessage: (lead?: Partial<Lead>, agentName?: string, agencyName?: string) => string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'property_match',
    title: 'Property Match',
    category: 'Property Details',
    getMessage: (lead, agentName = 'your property consultant', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || 'Prime Area';
      const bhk = lead?.bhk || '2 BHK';
      const price = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : '₹75 Lakh';

      return `Hi ${name},

I found some properties that match your requirement. Please check the details below:

🏠 Type: ${bhk}
📍 Location: ${loc}
💰 Price: ${price}

Please let me know if you like these options. I can arrange a site visit for you.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'welcome_customer',
    title: 'Welcome Customer',
    category: 'Greeting',
    getMessage: (lead, agentName = 'your property advisor', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const bhkText = lead?.bhk ? ` for ${lead.bhk}` : '';
      const locText = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations[0] : '') || lead?.preferredCity || '';
      const locSuffix = locText ? ` in ${locText}` : '';

      return `Hi ${name},

Thank you for contacting me. Welcome to ${agencyName}!

Please share your property requirement${bhkText}${locSuffix}. I will help you find a suitable property within your budget.

When is a good time to speak with you?

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'requirement_confirmation',
    title: 'Requirement Confirmation',
    category: 'Greeting',
    getMessage: (lead, agentName = 'your property consultant', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'Preferred Area';
      const bhk = lead?.bhk || 'Residential Property';
      const budget = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : (lead?.budgetMin ? formatIndianCurrency(lead.budgetMin) : '₹60 Lakh - ₹1 Cr');

      return `Hi ${name},

I have noted your requirement:

🏠 Looking for: ${bhk}
📍 Preferred Area: ${loc}
💰 Budget: ${budget}

I will check for suitable properties and share them with you shortly.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'share_property_details',
    title: 'Share Property Details',
    category: 'Property Details',
    getMessage: (lead, agentName = 'your property advisor', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'Prime Area';
      const bhk = lead?.bhk || 'Apartment';
      const price = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : 'Best Market Price';

      return `Hi ${name},

Here are the property details. Please check and let me know if you are interested:

🏠 Property: ${bhk}
📍 Location: ${loc}
💰 Price: ${price}
🌟 Highlights: Gated society, parking, security, power backup

Please let me know if you would like me to share more photos and floor plans.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'property_location',
    title: 'Property Location',
    category: 'Property Details',
    getMessage: (lead, agentName = 'your property consultant', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'the project location';

      return `Hi ${name},

Here is the property location:
📍 Location: ${loc}

The location has good road connectivity with nearby markets, schools, and hospitals.

You can check the location and let me know if you would like to visit. I can also share the map location pin.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'price_details',
    title: 'Price Details',
    category: 'Property Details',
    getMessage: (lead, agentName = 'your property consultant', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'the property';
      const bhk = lead?.bhk || 'Property';
      const price = lead?.budgetMax ? formatIndianCurrency(lead.budgetMax) : '₹75 Lakh';

      return `Hi ${name},

Here are the price details for ${bhk} in ${loc}:

💰 Property Price: ${price}
📄 Booking Amount: 10%
🏦 Bank loan facility available from all major banks

Please let me know if you want more details or payment plan options.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'follow_up',
    title: 'Follow-up',
    category: 'Follow-up',
    getMessage: (lead, agentName = 'your property advisor', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'the property';

      return `Hi ${name},

Just checking if you had a chance to see the property details for ${loc}.

Please let me know what you think. I will be happy to help you with more options if you need.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'site_visit_invitation',
    title: 'Site Visit Invitation',
    category: 'Site Visit',
    getMessage: (lead, agentName = 'your property advisor', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'the site';
      const date = lead?.nextFollowUpDate || 'this weekend';
      const time = lead?.nextFollowUpTime ? ` at ${lead.nextFollowUpTime}` : '';

      return `Hi ${name},

Would you like to visit the property in ${loc}?

📅 Suggested Day: ${date}${time}
📍 Meeting Location: ${loc}

The sample flat is ready for viewing. Please let me know when you are free, and I will arrange your site visit.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'follow_up_reminder',
    title: 'Follow-up Reminder',
    category: 'Follow-up',
    getMessage: (lead, agentName = 'your property consultant', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';
      const loc = (lead?.preferredLocations && lead.preferredLocations.length > 0 ? lead.preferredLocations.join(', ') : '') || lead?.preferredCity || 'the property';

      return `Hi ${name},

Just following up about your property search in ${loc}.

Please let me know if you are still looking or if you have any questions. I am happy to help.

Regards,
${agentName}
${agencyName}`;
    },
  },
  {
    id: 'thank_you',
    title: 'Thank You',
    category: 'Closing',
    getMessage: (lead, agentName = 'your property advisor', agencyName = 'our agency') => {
      const name = lead?.name || 'Customer';

      return `Hi ${name},

Thank you for your time.

Please contact me if you need any help finding a property. I am always happy to help you.

Regards,
${agentName}
${agencyName}`;
    },
  },
];

/**
 * Builds a direct, UTF-8 safe WhatsApp Click-to-Chat URL.
 * Preserves all Unicode emojis, ₹ Indian Rupee symbols,
 * special characters, and line breaks without ASCII downgrading or character corruption.
 */
export function buildWhatsAppUrl(phone?: string, text?: string): string {
  const cleaned = phone ? cleanIndianPhone(phone) : '';
  const trimmedText = text ? text.trim() : '';
  
  // Standard UTF-8 URL percent-encoding preserving all Unicode codepoints
  const encodedText = trimmedText ? encodeURIComponent(trimmedText) : '';

  if (cleaned) {
    // api.whatsapp.com/send directly opens WhatsApp without intermediary redirect hops that strip 4-byte UTF-8 emojis
    return `https://api.whatsapp.com/send?phone=${cleaned}${encodedText ? `&text=${encodedText}` : ''}`;
  }
  
  return `https://api.whatsapp.com/send?${encodedText ? `text=${encodedText}` : ''}`;
}

/**
 * Open WhatsApp directly with full Unicode & Emoji preservation.
 */
export function openWhatsApp(phone: string, text?: string): void {
  const url = buildWhatsAppUrl(phone, text);
  if (!url) return;

  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // If popup was blocked, fallback to top-level window redirection or secondary attempt
      window.location.assign(url);
    }
  } catch (err) {
    console.warn('Notice opening WhatsApp window:', err);
    window.location.href = url;
  }
}

export const openWhatsAppDirect = openWhatsApp;

/**
 * Fallback-safe clipboard copy function that preserves emojis, Hindi characters,
 * ₹ symbol, line breaks, and all special Unicode characters.
 */
export async function copyUnicodeTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Primary: modern navigator.clipboard API
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard writeText failed, trying DOM fallback', err);
  }

  // 2. Fallback: Hidden DOM textarea with UTF-8 preservation
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('All clipboard copy attempts notice:', err);
    return false;
  }
}

export function openDialer(phone: string): void {
  if (!phone) return;
  window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
}
